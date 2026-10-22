import { defineEventHandler, setHeader } from 'h3'
import { db, type OrderRow, publicOrder } from '../../../utils/db'
import { requireAdmin } from '../../../utils/auth'
export default defineEventHandler(event => {
  requireAdmin(event)
  setHeader(event,'Cache-Control','no-store')
  const rows = db().prepare('SELECT o.*,c.order_id AS customer_order_id,c.confirmed_at FROM orders o LEFT JOIN customer_orders c ON c.order_id=o.id ORDER BY o.id DESC LIMIT 100').all() as (OrderRow&{customer_order_id:number|null;confirmed_at:number|null})[]
  return rows.map(r => ({ ...publicOrder(r,r.customer_order_id!==null&&r.confirmed_at===null), createdAt:r.created_at, updatedAt:r.updated_at }))
})
