import {test} from 'node:test'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {randomBytes,scryptSync} from 'node:crypto'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createServer} from 'node:http'
import {once} from 'node:events'
import Database from 'better-sqlite3'

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))
test('visitor checkout and private order messages are priced and authorized on the server',{timeout:45_000},async t=>{
  const dir=await mkdtemp(join(tmpdir(),'chits-customer-orders-')),sqlite=join(dir,'test.sqlite')
  const reserve=createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening')
  const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve))
  const base=`http://127.0.0.1:${port}`,password=randomBytes(24).toString('hex'),salt=randomBytes(16).toString('hex')
  const env={...process.env,NODE_ENV:'production',NITRO_HOST:'127.0.0.1',NITRO_PORT:String(port),SQLITE_PATH:sqlite,SESSION_SECRET:randomBytes(32).toString('hex'),ADMIN_PASSWORD_HASH:`${salt}:${scryptSync(password,salt,64).toString('hex')}`,PUBLIC_ORIGIN:base}
  let child,logs='',db
  db=new Database(sqlite)
  db.exec(`CREATE TABLE orders(id INTEGER PRIMARY KEY AUTOINCREMENT,order_number TEXT NOT NULL UNIQUE,status TEXT NOT NULL DEFAULT 'Preparing' CHECK(status IN ('Preparing','Ready','Served')),token_hash TEXT NOT NULL UNIQUE,nickname TEXT,avatar_key TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,served_at INTEGER,revoked_at INTEGER);
    CREATE TABLE customer_orders(order_id INTEGER PRIMARY KEY,visitor_id INTEGER NOT NULL,service_date TEXT NOT NULL,total_centavos INTEGER NOT NULL,staff_read_message_id INTEGER NOT NULL DEFAULT 0,visitor_read_message_id INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL);
    INSERT INTO orders(order_number,token_hash,created_at,updated_at) VALUES('OLD','old-token',100,100);
    INSERT INTO customer_orders(order_id,visitor_id,service_date,total_centavos,created_at) VALUES(1,999,'2000-01-01',3500,100);`)
  db.close();db=undefined
  const request=(path,{method='GET',cookie,body,origin=base}={})=>fetch(base+path,{method,headers:{...(method==='GET'?{}:{Origin:origin,'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)})
  const cookie=response=>response.headers.get('set-cookie').split(';')[0]
  t.after(async()=>{db?.close();if(child&&child.exitCode===null){const exit=once(child,'exit');child.kill();await exit}await rm(dir,{recursive:true,force:true});assert.doesNotMatch(logs,/\[uncaughtException\]|\[unhandledRejection\]/)})
  child=spawn(process.execPath,['.output/server/index.mjs'],{cwd:new URL('..',import.meta.url),env,stdio:['ignore','pipe','pipe']})
  child.stdout.on('data',data=>logs+=data);child.stderr.on('data',data=>logs+=data)
  for(let i=0;i<100;i++){try{if((await request('/api/store/status')).ok)break}catch{}if(child.exitCode!==null)throw new Error('Server exited');await delay(30)}
  const login=await request('/api/admin/login',{method:'POST',body:{password}});assert.equal(login.status,200);const staff=cookie(login)
  assert.equal((await request('/api/admin/orders',{cookie:staff}).then(r=>r.json()))[0].status,'Preparing')
  const one=await request('/api/visitors/join',{method:'POST',body:{avatar:'palitaw'}}),two=await request('/api/visitors/join',{method:'POST',body:{avatar:'biko'}})
  assert.equal(one.status,200);assert.equal(two.status,200);const a=cookie(one),b=cookie(two)
  const menu=await request('/api/admin/menu/today',{method:'POST',cookie:staff,body:{name:'Biko',priceCentavos:3500}})
  assert.equal(menu.status,200);const item=(await request('/api/menu/today').then(r=>r.json())).items[0]
  assert.equal((await request('/api/orders',{method:'POST',body:{items:[{id:item.id,quantity:2}]}})).status,401)
  assert.equal((await request('/api/orders',{method:'POST',cookie:a,origin:'https://attacker.example',body:{items:[{id:item.id,quantity:2}]}})).status,403)
  assert.equal((await request('/api/orders',{method:'POST',cookie:a,body:{items:[{id:item.id,quantity:2,priceCentavos:1},{id:item.id,quantity:1}]}})).status,400)
  const placed=await request('/api/orders',{method:'POST',cookie:a,body:{items:[{id:item.id,quantity:2,priceCentavos:1}]}})
  assert.equal(placed.status,200);const detail=await placed.json(),id=detail.order.id
  assert.equal(detail.order.number,'100');assert.equal(detail.order.totalCentavos,7000)
  assert.equal(detail.order.status,'Pending')
  assert.equal((await request('/api/orders/board').then(r=>r.json())).some(order=>order.id===id),false)
  assert.equal((await request('/api/admin/orders',{cookie:staff}).then(r=>r.json()))[0].status,'Pending')
  assert.deepEqual(detail.items.map(({name,quantity,lineTotalCentavos})=>({name,quantity,lineTotalCentavos})),[{name:'Biko',quantity:2,lineTotalCentavos:7000}])
  // The store replies at once asking for the delivery address; it arrives already read for the customer.
  assert.deepEqual(detail.messages.map(message=>message.role),['system','staff'])
  assert.match(detail.messages[1].text,/delivery address/)
  assert.equal((await request('/api/orders/mine',{cookie:a}).then(r=>r.json()))[0].unread,0)
  assert.equal((await request('/api/orders/mine',{cookie:a}).then(r=>r.json())).length,1)
  assert.deepEqual(await request('/api/orders/mine',{cookie:b}).then(r=>r.json()),[])
  assert.equal((await request(`/api/orders/${id}`,{cookie:b})).status,404)
  assert.equal((await request(`/api/orders/${id}/messages`,{method:'POST',cookie:b,body:{text:'Intrude'}})).status,404)
  assert.equal((await request('/api/admin/order-inbox',{cookie:a})).status,401)
  const staffInbox=await request('/api/admin/order-inbox',{cookie:staff}).then(r=>r.json())
  assert.equal(staffInbox[0].id,id);assert.equal(staffInbox[0].unread,1)
  assert.equal((await request(`/api/admin/orders/${id}/conversation`,{cookie:staff})).status,200)
  assert.equal((await request('/api/admin/order-inbox',{cookie:staff}).then(r=>r.json()))[0].unread,0)
  const asked=await request(`/api/orders/${id}/messages`,{method:'POST',cookie:a,body:{text:'Can you pack it carefully?'}})
  assert.equal(asked.status,200)
  assert.equal((await request('/api/admin/order-inbox',{cookie:staff}).then(r=>r.json()))[0].unread,1)
  const replied=await request(`/api/admin/orders/${id}/messages`,{method:'POST',cookie:staff,body:{text:'Yes, of course.'}})
  assert.equal(replied.status,200)
  assert.equal((await request('/api/orders/mine',{cookie:a}).then(r=>r.json()))[0].unread,1)
  assert.equal((await request(`/api/orders/${id}`,{cookie:a}).then(r=>r.json())).messages.at(-1).text,'Yes, of course.')
  assert.equal((await request('/api/orders/mine',{cookie:a}).then(r=>r.json()))[0].unread,0)
  assert.equal((await request(`/api/admin/orders/${id}`,{method:'PATCH',cookie:a,body:{name:'Intruder'}})).status,401)
  assert.equal((await request(`/api/admin/orders/${id}`,{method:'PATCH',cookie:staff,origin:'https://attacker.example',body:{name:'Intruder'}})).status,403)
  for(const name of [23,'Too long '.repeat(10),'Bad\nname'])assert.equal((await request(`/api/admin/orders/${id}`,{method:'PATCH',cookie:staff,body:{name}})).status,400)
  const named=await request(`/api/admin/orders/${id}`,{method:'PATCH',cookie:staff,body:{name:'  María Dela Cruz  '}})
  assert.equal(named.status,200);assert.equal((await named.json()).order.status,'Pending')
  assert.equal((await request(`/api/orders/${id}`,{cookie:a}).then(r=>r.json())).order.name,'María Dela Cruz')
  assert.equal((await request('/api/orders/board').then(r=>r.json())).some(order=>order.id===id),false)
  assert.equal((await request(`/api/admin/orders/${id}`,{method:'PATCH',cookie:staff,body:{name:''}}).then(r=>r.json())).order.name,null)
  assert.equal((await request(`/api/admin/orders/${id}`,{method:'PATCH',cookie:staff,body:{name:'María Dela Cruz'}}).then(r=>r.json())).order.name,'María Dela Cruz')
  assert.equal((await request(`/api/admin/orders/${id}`,{method:'PATCH',cookie:staff,body:{status:'Ready'}})).status,400)
  assert.equal((await request(`/api/admin/orders/${id}`,{method:'PATCH',cookie:staff,body:{status:'Preparing'}})).status,200)
  assert.equal((await request('/api/orders/mine',{cookie:a}).then(r=>r.json()))[0].status,'Preparing')
  const liveOrder=(await request('/api/orders/board').then(r=>r.json())).find(order=>order.id===id)
  assert.equal(liveOrder.status,'Preparing');assert.equal(liveOrder.name,'María Dela Cruz')
  assert.equal((await request(`/api/admin/orders/${id}`,{method:'PATCH',cookie:staff,body:{name:'Late change'}})).status,400)
  assert.equal((await request(`/api/admin/orders/${id}`,{method:'PATCH',cookie:staff,body:{status:'Ready'}})).status,200)
  assert.equal((await request('/api/orders/mine',{cookie:a}).then(r=>r.json()))[0].status,'Ready')
  const second=await request('/api/orders',{method:'POST',cookie:b,body:{items:[{id:item.id,quantity:1}]}})
  assert.equal(second.status,200);const secondId=(await second.json()).order.id
  assert.equal((await request(`/api/admin/orders/${secondId}`,{method:'PATCH',cookie:staff,body:{status:'Preparing',name:''}})).status,200)
  assert.equal((await request('/api/orders/board').then(r=>r.json())).find(order=>order.id===secondId).name,null)
  const thirdVisitor=await request('/api/visitors/join',{method:'POST',body:{avatar:'maja'}})
  assert.equal(thirdVisitor.status,200);const c=cookie(thirdVisitor)
  const third=await request('/api/orders',{method:'POST',cookie:c,body:{items:[{id:item.id,quantity:1}]}})
  assert.equal(third.status,200);const pending=(await third.json()).order
  assert.equal(pending.number,'102')
  assert.equal((await request(`/api/orders/${pending.id}/messages`,{method:'POST',cookie:c,body:{text:'Please hold this request.'}})).status,200)
  assert.equal((await request(`/api/admin/orders/${pending.id}`,{method:'DELETE'})).status,401)
  assert.equal((await request(`/api/admin/orders/${pending.id}`,{method:'DELETE',cookie:staff,origin:'https://attacker.example'})).status,403)
  assert.equal((await request('/api/admin/orders/not-an-id',{method:'DELETE',cookie:staff})).status,400)
  assert.equal((await request('/api/admin/orders/999999',{method:'DELETE',cookie:staff})).status,404)
  assert.equal((await request(`/api/admin/orders/${id}`,{method:'DELETE',cookie:staff})).status,409)
  const deleted=await request(`/api/admin/orders/${pending.id}`,{method:'DELETE',cookie:staff})
  assert.equal(deleted.status,200);assert.deepEqual(await deleted.json(),{number:'102'})
  assert.equal((await request(`/api/admin/orders/${pending.id}`,{method:'DELETE',cookie:staff})).status,404)
  assert.equal((await request(`/api/orders/${pending.id}`,{cookie:c})).status,404)
  assert.deepEqual(await request('/api/orders/mine',{cookie:c}).then(r=>r.json()),[])
  assert.equal((await request('/api/admin/orders',{cookie:staff}).then(r=>r.json())).some(order=>order.id===pending.id),false)
  db=new Database(sqlite)
  for(const table of ['orders','customer_orders','customer_order_items','order_messages'])assert.equal(db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${table==='orders'?'id':'order_id'}=?`).get(pending.id).count,0)
  assert.equal(db.prepare('SELECT next_number FROM order_sequence WHERE id=1').get().next_number,103)
  db.close();db=undefined
  const fourthVisitor=await request('/api/visitors/join',{method:'POST',body:{avatar:'biko'}})
  assert.equal(fourthVisitor.status,200)
  const fourth=await request('/api/orders',{method:'POST',cookie:cookie(fourthVisitor),body:{items:[{id:item.id,quantity:1}]}})
  assert.equal(fourth.status,200);assert.equal((await fourth.json()).order.number,'103')
  db=new Database(sqlite);assert.equal(db.prepare('SELECT COUNT(*) AS count FROM customer_order_items WHERE order_id=?').get(id).count,1)
  assert.equal(db.prepare('SELECT confirmed_at FROM customer_orders WHERE order_id=1').get().confirmed_at,100)
  const reset=await request('/api/admin/reset',{method:'POST',cookie:staff,body:{options:['orders'],confirmation:'RESET'}})
  assert.equal(reset.status,200);assert.equal(db.prepare('SELECT COUNT(*) AS count FROM order_messages').get().count,0)
  assert.deepEqual(await request('/api/orders/mine',{cookie:a}).then(r=>r.json()),[])
})
