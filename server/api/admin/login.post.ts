import { readJsonBody } from '../../utils/body'
import { defineEventHandler, createError } from 'h3'
import { checkAdminPassword, setAdmin, verifyOrigin, clientAddress } from '../../utils/auth'
const failures = new Map<string, { count: number; until: number }>()
export default defineEventHandler(async event => {
  verifyOrigin(event)
  const ip = clientAddress(event)
  for(const [key,entry] of failures)if(entry.until<=Date.now())failures.delete(key)
  if(!failures.has(ip)&&failures.size>=1024)throw createError({statusCode:429,statusMessage:'Too many attempts. Try later.'})
  const current = failures.get(ip)
  if (current && current.until > Date.now() && current.count >= 5) throw createError({ statusCode: 429, statusMessage: 'Too many attempts. Try later.' })
  const body = await readJsonBody<{ password?: string }>(event)
  const password = typeof body.password==='string'&&body.password.length<=300?body.password:''
  if (!password || !checkAdminPassword(password)) {
    const latest=failures.get(ip)
    const count = latest && latest.until > Date.now() ? latest.count + 1 : 1
    failures.set(ip, { count, until:Date.now() + 15 * 60_000 })
    throw createError({ statusCode: 401, statusMessage: 'Invalid admin password' })
  }
  failures.delete(ip)
  setAdmin(event)
  return { ok:true }
})
