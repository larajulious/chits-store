import { createError, defineEventHandler, setHeader } from 'h3'
import { requireAdmin, verifyOrigin } from '../../../utils/auth'
import { readJsonBody } from '../../../utils/body'
import { db } from '../../../utils/db'
import { menuItemId, menuToday, todayInManila } from '../../../utils/menu'
import { broadcast } from '../../../utils/room'

export default defineEventHandler(async event=>{
  requireAdmin(event);verifyOrigin(event)
  const body=await readJsonBody<{id?:unknown}>(event)
  const id=menuItemId(body.id)
  const result=db().prepare('DELETE FROM daily_menu WHERE id=? AND service_date=?').run(id,todayInManila())
  if(!result.changes)throw createError({statusCode:404,statusMessage:'Today’s menu item was not found'})
  broadcast({type:'menu_changed'})
  setHeader(event,'Cache-Control','no-store')
  return menuToday()
})
