import { defineEventHandler, createError, setHeader } from 'h3'
import { readJsonBody } from '../../utils/body'
import { db, getVisitor } from '../../utils/db'
import { requireVisitor, verifyOrigin, visitorName } from '../../utils/auth'
import { renameVisitor } from '../../utils/room'
import { checkNickname } from '../../../shared/nickname'

// A visitor sets (or, with an empty name, clears) their own name. A few changes per ten minutes, so names stay recognisable.
const RENAMES_PER_WINDOW=5,WINDOW_MS=10*60_000
const renames=new Map<number,{count:number;resetAt:number}>()
export default defineEventHandler(async event => {
  verifyOrigin(event)
  const visitor = requireVisitor(event)
  const body = await readJsonBody<{ nickname?: unknown }>(event)
  const check = checkNickname(body.nickname)
  if (!check.ok) throw createError({ statusCode: 400, statusMessage: check.reason })
  const now=Date.now()
  for(const [id,entry] of renames)if(entry.resetAt<=now)renames.delete(id)
  const entry=renames.get(visitor.id)??{count:0,resetAt:now+WINDOW_MS}
  if((check.nickname||null)!==visitor.nickname){
    if(entry.count>=RENAMES_PER_WINDOW)throw createError({ statusCode: 429, statusMessage: 'You changed your name a lot just now. Try again in a few minutes.' })
    entry.count++;renames.set(visitor.id,entry)
    db().prepare('UPDATE visitors SET nickname=? WHERE id=?').run(check.nickname||null, visitor.id)
  }
  const nickname=visitorName(getVisitor(visitor.id)!)
  renameVisitor(visitor.id,nickname)
  setHeader(event, 'Cache-Control', 'no-store')
  return { nickname }
})
