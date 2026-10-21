import { readJsonBody } from '../../../utils/body'
import { defineEventHandler, createError, setHeader } from 'h3'
import { randomBytes } from 'node:crypto'
import { db, type OrderRow, publicOrder } from '../../../utils/db'
import { requireAdmin, verifyOrigin } from '../../../utils/auth'
import { notifyOrderChanged } from '../../../utils/room'
export default defineEventHandler(async event => {
  requireAdmin(event); verifyOrigin(event)
  const input = await readJsonBody<{ number?: string }>(event)
  const number = typeof input.number==='string'?input.number.trim().toUpperCase():''
  if (!/^[A-Z0-9][A-Z0-9-]{2,23}$/.test(number)) throw createError({ statusCode: 400, statusMessage:'Use 3–24 letters, numbers, or hyphens' })
  if (db().prepare('SELECT id FROM orders WHERE order_number = ?').get(number)) throw createError({ statusCode:409, statusMessage:'Order number already exists' })
  // The token_hash column is kept only for backward compatibility with v0.1 databases.
  // It is not used for public entry and is never returned to clients.
  const legacyUnusedToken = randomBytes(32).toString('hex')
  const now = Date.now()
  try {
    const result = db().prepare('INSERT INTO orders (order_number,token_hash,created_at,updated_at) VALUES (?,?,?,?)')
      .run(number,legacyUnusedToken,now,now)
    const order = db().prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid) as OrderRow
    notifyOrderChanged(order)
    setHeader(event,'Cache-Control','no-store')
    return { order:publicOrder(order) }
  } catch (e: any) {
    if (String(e?.code).includes('CONSTRAINT')) throw createError({ statusCode:409, statusMessage:'Order already exists' })
    throw e
  }
})
