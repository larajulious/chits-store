import { defineEventHandler, setHeader } from 'h3'
import { db, publicOrder, type OrderRow } from '../../utils/db'
export default defineEventHandler(event => {
  setHeader(event, 'Cache-Control', 'no-store')
  // The staff-entered order name is shown on the live board; session and token details stay private.
  const rows = db().prepare(`
    SELECT o.id, o.order_number, o.nickname, o.status, o.updated_at, o.delivered_at FROM orders o
    LEFT JOIN customer_orders c ON c.order_id=o.id
    WHERE o.revoked_at IS NULL AND (o.delivered_at IS NULL OR o.delivered_at > ?)
      AND (c.order_id IS NULL OR c.confirmed_at IS NOT NULL)
    ORDER BY o.updated_at DESC LIMIT 100
  `).all(Date.now() - 5 * 60_000) as OrderRow[]
  return rows.map(row=>publicOrder(row))
})
