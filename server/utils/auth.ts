import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto'
import { createError, getCookie, setCookie, deleteCookie, getHeader } from 'h3'
import { isIP } from 'node:net'
import type { H3Event } from 'h3'
import { activeVisitor, getVisitor } from './db'
import { avatarOptions } from '../../shared/avatars'

const ADMIN_COOKIE = 'chits_admin'
const VISITOR_COOKIE = 'chits_visitor'
const ADMIN_DURATION = 12 * 60 * 60_000
const VISITOR_DURATION = 7 * 24 * 60 * 60_000

function secret() {
  const value = process.env.SESSION_SECRET
  if (!value || value.length < 32 || value.startsWith('replace_')) throw new Error('SESSION_SECRET must be configured. Run npm run setup.')
  return value
}
function signature(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('hex')
}
function sign(scope: string, id: number, expires: number) {
  const body = `${scope}.${id}.${expires}`
  return `${body}.${signature(body)}`
}
function verify(value: string | undefined, scope: string): { id:number; expiresAt:number } | null {
  if (!value) return null
  const parts = value.split('.')
  if (parts.length !== 4 || parts[0] !== scope) return null
  const [name, idString, until, mac] = parts
  if (!idString || !until || !mac || !/^[1-9]\d*$/.test(idString) || !/^\d+$/.test(until) || !Number.isSafeInteger(Number(idString)) || !Number.isSafeInteger(Number(until)) || Number(until) <= Date.now()) return null
  const body = `${name}.${idString}.${until}`
  if (!/^[0-9a-f]{64}$/.test(mac)) return null
  const expected = Buffer.from(signature(body), 'hex')
  const actual = Buffer.from(mac, 'hex')
  if (!timingSafeEqual(expected, actual)) return null
  return { id:Number(idString), expiresAt:Number(until) }
}
function opts(seconds: number) {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/', maxAge: Math.floor(seconds) }
}
export function setAdmin(event: H3Event) { setCookie(event, ADMIN_COOKIE, sign('admin', 1, Date.now() + ADMIN_DURATION), opts(ADMIN_DURATION / 1000)) }
export function clearAdmin(event: H3Event) { deleteCookie(event, ADMIN_COOKIE, { path: '/' }) }
export function isAdmin(event: H3Event) { return verify(getCookie(event, ADMIN_COOKIE), 'admin')?.id === 1 }
export function requireAdmin(event: H3Event) { if (!isAdmin(event)) throw createError({ statusCode: 401, statusMessage: 'Admin login required' }) }
export function checkAdminPassword(pass: string) {
  const stored = process.env.ADMIN_PASSWORD_HASH
  if (!stored) throw new Error('ADMIN_PASSWORD_HASH missing. Run npm run setup.')
  const [salt, hex] = stored.split(':')
  if (!salt || !hex || !/^[0-9a-f]+$/.test(hex)) throw new Error('Invalid password hash configuration')
  const actual = scryptSync(pass, salt, 64)
  const expected = Buffer.from(hex, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
export function setVisitor(event: H3Event, id: number) {
  setCookie(event, VISITOR_COOKIE, sign('visitor', id, Date.now() + VISITOR_DURATION), opts(VISITOR_DURATION / 1000))
}
export function visitorSessionFromCookie(raw?: string) {
  const cookie = raw?.split(';').map(x => x.trim()).find(x => x.startsWith(`${VISITOR_COOKIE}=`))
  let value: string | undefined
  try { value = cookie ? decodeURIComponent(cookie.slice(VISITOR_COOKIE.length + 1)) : undefined } catch { return null }
  const session = verify(value, 'visitor')
  if (!session) return null
  const visitor = getVisitor(session.id)
  return activeVisitor(visitor) ? {visitor:visitor!,expiresAt:session.expiresAt} : null
}
export function visitorFromCookie(raw?: string) { return visitorSessionFromCookie(raw)?.visitor ?? null }
export function requireVisitor(event: H3Event) {
  const visitor = visitorFromCookie(getHeader(event, 'cookie'))
  if (!visitor) throw createError({ statusCode: 401, statusMessage: 'Choose your avatar to enter the store' })
  return visitor
}
export function visitorName(visitor: { id: number; avatar_key: string }) {
  const title=avatarOptions.find(avatar=>avatar.id===visitor.avatar_key)?.label || 'Guest'
  return `${title} #${String(visitor.id).padStart(3,'0')}`
}
export function allowedOrigin(origin: string|null|undefined, host: string|null|undefined) {
  if (!origin || !host) return false
  try {
    const url=new URL(origin)
    return ['http:','https:'].includes(url.protocol) && url.origin===origin && url.host===host &&
      (!process.env.PUBLIC_ORIGIN || origin===new URL(process.env.PUBLIC_ORIGIN).origin)
  } catch { return false }
}
export function verifyOrigin(event: H3Event) {
  if (!allowedOrigin(getHeader(event,'origin'),getHeader(event,'host'))) throw createError({statusCode:403,statusMessage:'Invalid request origin'})
}
export function clientAddress(event: H3Event) {
  const remote=event.node.req.socket.remoteAddress || 'unknown'
  const forwarded=getHeader(event,'x-real-ip') || ''
  return process.env.TRUST_PROXY==='1' && ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remote) && isIP(forwarded) ? forwarded : remote
}
