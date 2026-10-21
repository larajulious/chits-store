import { defineEventHandler, setHeader } from 'h3'
import { db, type OrderRow, publicOrder } from '../../../utils/db'
import { requireAdmin } from '../../../utils/auth'
export default defineEventHandler(event => {
  requireAdmin(event)
  setHeader(event,'Cache-Control','no-store')
  const rows = db().prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 100').all() as OrderRow[]
  return rows.map(r => ({ ...publicOrder(r), createdAt:r.created_at, updatedAt:r.updated_at }))
})
