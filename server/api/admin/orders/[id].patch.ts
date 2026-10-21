import { readJsonBody } from '../../../utils/body'
import { defineEventHandler, createError, getRouterParam } from 'h3'
import { db, getOrder, publicOrder, type Status } from '../../../utils/db'
import { requireAdmin, verifyOrigin } from '../../../utils/auth'
import { notifyOrderChanged } from '../../../utils/room'
export default defineEventHandler(async event => {
  requireAdmin(event); verifyOrigin(event)
  const id = Number(getRouterParam(event,'id'))
  if(!Number.isSafeInteger(id)||id<1)throw createError({statusCode:400,statusMessage:'Invalid order ID'})
  const body = await readJsonBody<{ status?: Status }>(event)
  const order = getOrder(id)
  if (!order) throw createError({ statusCode:404, statusMessage:'Order not found' })
  const next: Record<Status, Status | null> = { Preparing:'Ready',Ready:'Served',Served:null }
  if (body?.status !== order.status && body?.status !== next[order.status]) {
    throw createError({ statusCode:400, statusMessage:'Only the next status is allowed; Served is final' })
  }
  if(body.status===order.status)return {order:publicOrder(order)}
  if (body.status !== order.status) {
    const now = Date.now()
    db().prepare('UPDATE orders SET status = ?,updated_at = ?,served_at = CASE WHEN ? = \'Served\' THEN ? ELSE served_at END WHERE id = ?')
      .run(body.status,now,body.status,now,id)
  }
  const changed = getOrder(id)!
  notifyOrderChanged(changed)
  return { order:publicOrder(changed) }
})
