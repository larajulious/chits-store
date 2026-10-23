import { readJsonBody } from '../../utils/body'
import { isAvatar } from '../../../shared/avatars'
import { checkNickname } from '../../../shared/nickname'
import { defineEventHandler, createError, setHeader } from 'h3'
import { db, getVisitor } from '../../utils/db'
import { setVisitor, verifyOrigin, visitorFromCookie, visitorName, clientAddress } from '../../utils/auth'

const attempts = new Map<string, { count: number; resetAt: number }>()
export default defineEventHandler(async event => {
  verifyOrigin(event)
  const ip = clientAddress(event)
  const now = Date.now()
  for(const [key,entry] of attempts)if(entry.resetAt<=now)attempts.delete(key)
  if(!attempts.has(ip)&&attempts.size>=1024)throw createError({statusCode:429,statusMessage:'Too many requests. Try later.'})
  const old = attempts.get(ip)
  const entry = old && old.resetAt > now ? old : { count: 0, resetAt: now + 60_000 }
  entry.count++
  attempts.set(ip, entry)
  if (entry.count > 15) throw createError({ statusCode: 429, statusMessage: 'Too many requests. Try again in a minute.' })
  const body = await readJsonBody<{ avatar?: string; nickname?: unknown }>(event)
  const avatar = typeof body.avatar==='string'?body.avatar:''
  if (!isAvatar(avatar)) throw createError({ statusCode: 400, statusMessage: 'Choose a valid avatar' })
  // An optional name typed at the door; left empty, a returning visitor keeps the name they had.
  const named = body.nickname===undefined ? {ok:true as const,nickname:''} : checkNickname(body.nickname)
  if (!named.ok) throw createError({ statusCode: 400, statusMessage: named.reason })
  // A closed store still lets visitors in: they land on the street outside (see server/routes/ws.ts).
  const previous = visitorFromCookie(event.node.req.headers.cookie || '')
  let id: number
  if (previous) {
    id = previous.id
    db().prepare('UPDATE visitors SET avatar_key=?, last_seen_at=?, nickname=COALESCE(?,nickname) WHERE id=?').run(avatar, now, named.nickname||null, id)
  } else {
    const result = db().prepare('INSERT INTO visitors (avatar_key, created_at, last_seen_at, nickname) VALUES (?,?,?,?)').run(avatar, now, now, named.nickname||null)
    id = Number(result.lastInsertRowid)
  }
  setVisitor(event, id)
  setHeader(event, 'Cache-Control', 'no-store')
  return { nickname: visitorName(getVisitor(id)!), avatar }
})
