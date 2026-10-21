import { readJsonBody } from '../../../utils/body'
import { defineEventHandler, createError, setHeader } from 'h3'
import { randomBytes } from 'node:crypto'
import { db, type OrderRow, publicOrder } from '../../../utils/db'
import { requireAdmin, verifyOrigin } from '../../../utils/auth'
import { notifyOrderChanged } from '../../../utils/room'
export default defineEventHandler(async event => {
  requireAdmin(event); verifyOrigin(event)
  await readJsonBody<Record<string,unknown>>(event)
  // The token_hash column is kept only for backward compatibility with v0.1 databases.
  // It is not used for public entry and is never returned to clients.
  const legacyUnusedToken = randomBytes(32).toString('hex')
  const now = Date.now()
  try {
    const connection=db()
    const order=connection.transaction(()=>{
      const sequence=connection.prepare('SELECT next_number FROM order_sequence WHERE id=1').get() as {next_number:number}|undefined
      let next=sequence?.next_number??100
      const exists=connection.prepare('SELECT 1 FROM orders WHERE order_number=?')
      while(Number.isSafeInteger(next)&&exists.get(String(next)))next++
      if(!Number.isSafeInteger(next)||next>=Number.MAX_SAFE_INTEGER)throw createError({statusCode:503,statusMessage:'Order numbering limit reached'})
      const result=connection.prepare('INSERT INTO orders(order_number,token_hash,created_at,updated_at) VALUES(?,?,?,?)').run(String(next),legacyUnusedToken,now,now)
      connection.prepare('INSERT INTO order_sequence(id,next_number) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET next_number=excluded.next_number').run(next+1)
      return connection.prepare('SELECT * FROM orders WHERE id=?').get(result.lastInsertRowid) as OrderRow
    }).immediate()
    notifyOrderChanged(order)
    setHeader(event,'Cache-Control','no-store')
    return { order:publicOrder(order) }
  } catch (e: any) {
    if (String(e?.code).includes('CONSTRAINT')) throw createError({ statusCode:409, statusMessage:'Order already exists' })
    throw e
  }
})
