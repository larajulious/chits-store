import { createError, defineEventHandler, setHeader } from 'h3'
import { requireAdmin, verifyOrigin } from '../../../utils/auth'
import { readJsonBody } from '../../../utils/body'
import { db } from '../../../utils/db'
import { menuItemId, menuItemInput, menuToday, todayInManila } from '../../../utils/menu'
import { broadcast } from '../../../utils/room'

export default defineEventHandler(async event=>{
  requireAdmin(event);verifyOrigin(event)
  const body=await readJsonBody<{id?:unknown;name?:unknown;priceCentavos?:unknown}>(event)
  const id=menuItemId(body.id),input=menuItemInput(body)
  const result=db().prepare('UPDATE daily_menu SET name=?,price_centavos=?,updated_at=? WHERE id=? AND service_date=?').run(input.name,input.priceCentavos,Date.now(),id,todayInManila())
  if(!result.changes)throw createError({statusCode:404,statusMessage:'Today’s menu item was not found'})
  broadcast({type:'menu_changed'})
  setHeader(event,'Cache-Control','no-store')
  return menuToday()
})
