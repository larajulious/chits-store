import { readJsonBody } from '../../utils/body'
import { defineEventHandler, createError } from 'h3'
import { requireAdmin, verifyOrigin } from '../../utils/auth'
import { disconnectVisitor, roomAdminState, setChatEnabled, toggleMuteVisitor } from '../../utils/room'
export default defineEventHandler(async event => {
  requireAdmin(event); verifyOrigin(event)
  const body = await readJsonBody<{action?:string;id?:string;enabled?:boolean}>(event)
  const current = roomAdminState()
  if (body.action === 'toggle_chat' && typeof body.enabled === 'boolean') setChatEnabled(body.enabled)
  else if ((body.action==='mute' || body.action==='kick') && body.id) {
    const target = current.members.find(p=>p.id===body.id)
    if (!target) throw createError({statusCode:404,statusMessage:'Visitor has left the room'})
    if (body.action==='mute') toggleMuteVisitor(target.visitorId)
    else disconnectVisitor(target.id)
  } else throw createError({statusCode:400,statusMessage:'Invalid moderation action'})
  return roomAdminState()
})
