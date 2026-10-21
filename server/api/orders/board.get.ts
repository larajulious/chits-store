import { defineEventHandler, setHeader } from 'h3'
import { db, publicOrder, type OrderRow } from '../../utils/db'
export default defineEventHandler(event => {
  setHeader(event, 'Cache-Control', 'no-store')
  // The staff-entered order name is shown on the live board; session and token details stay private.
  const rows = db().prepare(`
    SELECT id, order_number, nickname, status, updated_at, delivered_at FROM orders
    WHERE revoked_at IS NULL AND (delivered_at IS NULL OR delivered_at > ?)
    ORDER BY updated_at DESC LIMIT 100
  `).all(Date.now() - 5 * 60_000) as OrderRow[]
  return rows.map(publicOrder)
})
