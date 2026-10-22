import { readJsonBody } from '../../../utils/body'
import { defineEventHandler, createError, getRouterParam } from 'h3'
import { db, getOrder, publicOrder, type Status } from '../../../utils/db'
import { requireAdmin, verifyOrigin } from '../../../utils/auth'
import { notifyOrderChanged } from '../../../utils/room'
import {orderNextStatus} from '../../../../shared/order-status'
import {confirmCustomerOrder,savePendingOrderName} from '../../../utils/customer-orders'
import {orderNameInput} from '../../../utils/order-name'
export default defineEventHandler(async event => {
  requireAdmin(event); verifyOrigin(event)
  const id = Number(getRouterParam(event,'id'))
  if(!Number.isSafeInteger(id)||id<1)throw createError({statusCode:400,statusMessage:'Invalid order ID'})
  const body = await readJsonBody<{ status?: Status;name?:unknown }>(event)
  const order = getOrder(id)
  if (!order) throw createError({ statusCode:404, statusMessage:'Order not found' })
  const customer=db().prepare('SELECT confirmed_at FROM customer_orders WHERE order_id=?').get(id) as {confirmed_at:number|null}|undefined
  const pending=Boolean(customer&&customer.confirmed_at===null)
  const name=body.name===undefined?undefined:orderNameInput(body.name)
  if(name!==undefined&&!pending)throw createError({statusCode:400,statusMessage:'Only pending customer orders can be named here'})
  const current=publicOrder(order,pending).status
  if(pending&&name!==undefined&&(body.status===undefined||body.status==='Pending'))return {order:publicOrder(savePendingOrderName(id,name),true)}
  if(body.status===current)return {order:publicOrder(order,pending)}
  if(!orderNextStatus[current]||body.status!==orderNextStatus[current])throw createError({statusCode:400,statusMessage:'Only the next status is allowed; Delivered is final'})
  if(pending){
    const confirmed=confirmCustomerOrder(id,name)
    notifyOrderChanged(confirmed)
    return {order:publicOrder(confirmed)}
  }
  const now = Date.now()
  if(body.status==='Delivered'){
    db().prepare('UPDATE orders SET delivered_at=?,updated_at=? WHERE id=? AND delivered_at IS NULL').run(now,now,id)
  }else{
    db().prepare('UPDATE orders SET status = ?,updated_at = ?,served_at = CASE WHEN ? = \'Served\' THEN ? ELSE served_at END WHERE id = ?')
      .run(body.status,now,body.status,now,id)
  }
  const changed = getOrder(id)!
  notifyOrderChanged(changed)
  return { order:publicOrder(changed) }
})
