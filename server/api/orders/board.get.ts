import { defineEventHandler, setHeader } from 'h3'
import { db, publicOrder, type OrderRow } from '../../utils/db'
export default defineEventHandler(event => {
  setHeader(event, 'Cache-Control', 'no-store')
  // Order numbers and statuses are public. Customer details must never be returned.
  const rows = db().prepare(`
    SELECT id, order_number, status, updated_at FROM orders
    WHERE revoked_at IS NULL AND (status != 'Served' OR served_at > ?)
    ORDER BY updated_at DESC LIMIT 100
  `).all(Date.now() - 5 * 60_000) as OrderRow[]
  return rows.map(publicOrder)
})
