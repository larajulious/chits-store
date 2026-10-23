import { randomBytes } from 'node:crypto'
import { createError } from 'h3'
import { db, getOrder, publicOrder, type OrderRow } from './db'
import { todayInManila } from './menu'
import { visitorName } from './auth'

type ItemRow = { id:number; order_id:number; menu_item_id:number; name:string; price_centavos:number; quantity:number; line_total_centavos:number }
type MessageRow = { id:number; order_id:number; role:'visitor'|'staff'|'system'; text:string; created_at:number }
type CustomerOrderRow = { order_id:number; visitor_id:number; service_date:string; total_centavos:number; confirmed_at:number|null; staff_read_message_id:number; visitor_read_message_id:number; created_at:number }
type InboxRow = CustomerOrderRow & OrderRow & { visitor_avatar_key:string|null; visitor_nickname:string|null; last_message:string|null; unread:number }

// Sent from the store as soon as an order is placed, so the customer can share the address while staff are on their way.
export const ORDER_AUTO_REPLY='Thank you so much for your order! May we kindly ask for your delivery address? One of our staff members will be with you shortly to confirm your order. We appreciate your patience!'

export function validOrderId(value:unknown){
  const id=Number(value)
  if(!Number.isSafeInteger(id)||id<1)throw createError({statusCode:400,statusMessage:'Invalid order ID'})
  return id
}

export function customerOrder(id:number,visitorId?:number){
  const row=db().prepare('SELECT * FROM customer_orders WHERE order_id=?').get(id) as CustomerOrderRow|undefined
  if(!row||visitorId!==undefined&&row.visitor_id!==visitorId)throw createError({statusCode:404,statusMessage:'Order not found'})
  return row
}

export function orderSummary(row:InboxRow){
  return { ...publicOrder(row,row.confirmed_at===null), visitor:visitorName({id:row.visitor_id,avatar_key:row.visitor_avatar_key||'',nickname:row.visitor_nickname}), totalCentavos:row.total_centavos, createdAt:row.created_at, lastMessage:row.last_message, unread:row.unread }
}

export function orderInbox(visitorId?:number){
  const rows=db().prepare(`
    SELECT o.*, c.*, v.avatar_key AS visitor_avatar_key, v.nickname AS visitor_nickname,
      (SELECT text FROM order_messages WHERE order_id=o.id ORDER BY id DESC LIMIT 1) AS last_message,
      (SELECT count(*) FROM order_messages WHERE order_id=o.id AND id >
        CASE WHEN ? IS NULL THEN c.staff_read_message_id ELSE c.visitor_read_message_id END
        AND (CASE WHEN ? IS NULL THEN role IN ('visitor','system') ELSE role='staff' END)) AS unread
    FROM customer_orders c JOIN orders o ON o.id=c.order_id LEFT JOIN visitors v ON v.id=c.visitor_id
    WHERE (? IS NULL OR c.visitor_id=?)
    ORDER BY COALESCE((SELECT max(created_at) FROM order_messages WHERE order_id=o.id),c.created_at) DESC,o.id DESC LIMIT 100
  `).all(visitorId??null,visitorId??null,visitorId??null,visitorId??null) as InboxRow[]
  return rows.map(orderSummary)
}

export function orderDetail(id:number,visitorId?:number,markRead=true){
  const owner=customerOrder(id,visitorId)
  const connection=db()
  const items=connection.prepare('SELECT * FROM customer_order_items WHERE order_id=? ORDER BY id').all(id) as ItemRow[]
  const messages=connection.prepare('SELECT * FROM order_messages WHERE order_id=? ORDER BY id DESC LIMIT 100').all(id) as MessageRow[]
  if(markRead){
    const field=visitorId===undefined?'staff_read_message_id':'visitor_read_message_id'
    connection.prepare(`UPDATE customer_orders SET ${field}=max(${field},?) WHERE order_id=?`).run(messages[0]?.id??0,id)
  }
  const order=getOrder(id)!
  return {
    order:{...publicOrder(order,owner.confirmed_at===null),totalCentavos:owner.total_centavos,createdAt:owner.created_at,serviceDate:owner.service_date},
    items:items.map(item=>({id:item.menu_item_id,name:item.name,priceCentavos:item.price_centavos,quantity:item.quantity,lineTotalCentavos:item.line_total_centavos})),
    messages:messages.reverse().map(message=>({id:message.id,role:message.role,text:message.text,at:message.created_at}))
  }
}

export function createCustomerOrder(visitorId:number,rawItems:unknown){
  if(!Array.isArray(rawItems)||rawItems.length<1||rawItems.length>20)throw createError({statusCode:400,statusMessage:'Choose 1–20 menu items'})
  const requested=new Map<number,number>()
  for(const item of rawItems){
    if(!item||typeof item!=='object'||Array.isArray(item))throw createError({statusCode:400,statusMessage:'Invalid cart item'})
    const {id,quantity}=item as {id:unknown;quantity:unknown}
    if(!Number.isSafeInteger(id)||Number(id)<1||!Number.isSafeInteger(quantity)||Number(quantity)<1||Number(quantity)>20||requested.has(id as number))throw createError({statusCode:400,statusMessage:'Invalid item or quantity'})
    requested.set(id as number,quantity as number)
  }
  const connection=db(),date=todayInManila(),now=Date.now()
  const order=connection.transaction(()=>{
    const recent=connection.prepare('SELECT count(*) AS count,max(created_at) AS latest FROM customer_orders WHERE visitor_id=? AND created_at>?').get(visitorId,now-10*60_000) as {count:number;latest:number|null}
    if(recent.count>=5||recent.latest!==null&&now-recent.latest<3000)throw createError({statusCode:429,statusMessage:'Please wait before placing another order'})
    const menu=connection.prepare('SELECT id,name,price_centavos FROM daily_menu WHERE service_date=?').all(date) as {id:number;name:string;price_centavos:number}[]
    const byId=new Map(menu.map(item=>[item.id,item]))
    const lines=[...requested].map(([id,quantity])=>{
      const item=byId.get(id)
      if(!item)throw createError({statusCode:409,statusMessage:'The menu changed. Refresh your cart and try again.'})
      return {...item,quantity,lineTotal:item.price_centavos*quantity}
    })
    const total=lines.reduce((sum,line)=>sum+line.lineTotal,0)
    const sequence=connection.prepare('SELECT next_number FROM order_sequence WHERE id=1').get() as {next_number:number}|undefined
    let next=sequence?.next_number??100
    const exists=connection.prepare('SELECT 1 FROM orders WHERE order_number=?')
    while(Number.isSafeInteger(next)&&exists.get(String(next)))next++
    if(!Number.isSafeInteger(next)||next>=Number.MAX_SAFE_INTEGER)throw createError({statusCode:503,statusMessage:'Order numbering limit reached'})
    const token=randomBytes(32).toString('hex')
    const result=connection.prepare('INSERT INTO orders(order_number,token_hash,created_at,updated_at) VALUES(?,?,?,?)').run(String(next),token,now,now)
    const id=Number(result.lastInsertRowid)
    connection.prepare('INSERT INTO order_sequence(id,next_number) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET next_number=excluded.next_number').run(next+1)
    connection.prepare('INSERT INTO customer_orders(order_id,visitor_id,service_date,total_centavos,created_at) VALUES(?,?,?,?,?)').run(id,visitorId,date,total,now)
    const insertLine=connection.prepare('INSERT INTO customer_order_items(order_id,menu_item_id,name,price_centavos,quantity,line_total_centavos) VALUES(?,?,?,?,?,?)')
    for(const line of lines)insertLine.run(id,line.id,line.name,line.price_centavos,line.quantity,line.lineTotal)
    connection.prepare("INSERT INTO order_messages(order_id,role,text,created_at) VALUES(?,'system',?,?)").run(id,`New order #${next} · ${lines.map(line=>`${line.quantity} × ${line.name}`).join(', ')} · ₱${(total/100).toFixed(2)}`,now)
    // The auto-reply counts as a staff message, so it doesn't add to the staff's unread count.
    // The customer gets both messages in the order response, so both start as read for them.
    const reply=connection.prepare("INSERT INTO order_messages(order_id,role,text,created_at) VALUES(?,'staff',?,?)").run(id,ORDER_AUTO_REPLY,now)
    connection.prepare('UPDATE customer_orders SET visitor_read_message_id=? WHERE order_id=?').run(reply.lastInsertRowid,id)
    return getOrder(id)!
  }).immediate()
  return order
}

export function confirmCustomerOrder(id:number,name?:string){
  const connection=db(),now=Date.now()
  const result=connection.transaction(()=>{
    const updated=connection.prepare('UPDATE customer_orders SET confirmed_at=? WHERE order_id=? AND confirmed_at IS NULL').run(now,id)
    if(updated.changes!==1)throw createError({statusCode:409,statusMessage:'Order was already confirmed'})
    if(name===undefined)connection.prepare('UPDATE orders SET updated_at=? WHERE id=?').run(now,id)
    else connection.prepare('UPDATE orders SET nickname=?,updated_at=? WHERE id=?').run(name||null,now,id)
    const message=connection.prepare("INSERT INTO order_messages(order_id,role,text,created_at) VALUES(?,'system',?,?)").run(id,'Staff confirmed your order. Preparing now.',now)
    connection.prepare('UPDATE customer_orders SET staff_read_message_id=? WHERE order_id=?').run(message.lastInsertRowid,id)
    return getOrder(id)!
  }).immediate()
  return result
}

export function savePendingOrderName(id:number,name:string){
  const result=db().prepare('UPDATE orders SET nickname=?,updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM customer_orders WHERE order_id=? AND confirmed_at IS NULL)').run(name||null,Date.now(),id,id)
  if(result.changes!==1)throw createError({statusCode:409,statusMessage:'Only pending customer orders can be named here'})
  return getOrder(id)!
}

export function deletePendingCustomerOrder(id:number){
  const connection=db()
  return connection.transaction(()=>{
    const order=getOrder(id)
    if(!order)throw createError({statusCode:404,statusMessage:'Order not found'})
    const customer=connection.prepare('SELECT confirmed_at FROM customer_orders WHERE order_id=?').get(id) as {confirmed_at:number|null}|undefined
    if(!customer||customer.confirmed_at!==null)throw createError({statusCode:409,statusMessage:'Only pending customer orders can be deleted'})
    connection.prepare('DELETE FROM order_messages WHERE order_id=?').run(id)
    connection.prepare('DELETE FROM customer_order_items WHERE order_id=?').run(id)
    connection.prepare('DELETE FROM customer_orders WHERE order_id=? AND confirmed_at IS NULL').run(id)
    connection.prepare('DELETE FROM orders WHERE id=?').run(id)
    return {number:order.order_number}
  }).immediate()
}

export function postOrderMessage(id:number,role:'visitor'|'staff',text:unknown,visitorId?:number){
  customerOrder(id,visitorId)
  if(typeof text!=='string')throw createError({statusCode:400,statusMessage:'Message text is required'})
  const clean=text.normalize('NFKC').replace(/[\p{C}]/gu,'').trim()
  if(!clean||clean.length>500)throw createError({statusCode:400,statusMessage:'Use 1–500 characters for your message'})
  const connection=db(),now=Date.now()
  // The automatic reply isn't a staff member typing, so it never holds up their first real reply.
  const last=connection.prepare('SELECT created_at FROM order_messages WHERE order_id=? AND role=? AND text<>? ORDER BY id DESC LIMIT 1').get(id,role,ORDER_AUTO_REPLY) as {created_at:number}|undefined
  if(last&&now-last.created_at<1000)throw createError({statusCode:429,statusMessage:'Please wait before sending another message'})
  connection.prepare('INSERT INTO order_messages(order_id,role,text,created_at) VALUES(?,?,?,?)').run(id,role,clean,now)
  return orderDetail(id,visitorId)
}
