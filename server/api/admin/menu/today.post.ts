import { createError, defineEventHandler, setHeader } from 'h3'
import { requireAdmin, verifyOrigin } from '../../../utils/auth'
import { readJsonBody } from '../../../utils/body'
import { db } from '../../../utils/db'
import { menuItemInput, menuToday, todayInManila } from '../../../utils/menu'
import { broadcast } from '../../../utils/room'

export default defineEventHandler(async event=>{
  requireAdmin(event);verifyOrigin(event)
  const input=menuItemInput(await readJsonBody(event))
  const date=todayInManila(),now=Date.now(),connection=db()
  connection.transaction(()=>{
    const count=(connection.prepare('SELECT COUNT(*) AS count FROM daily_menu WHERE service_date=?').get(date) as {count:number}).count
    if(count>=30)throw createError({statusCode:409,statusMessage:'Today’s menu is full (30 items)'})
    connection.prepare('INSERT INTO daily_menu(service_date,name,price_centavos,created_at,updated_at) VALUES(?,?,?,?,?)').run(date,input.name,input.priceCentavos,now,now)
  }).immediate()
  broadcast({type:'menu_changed'})
  setHeader(event,'Cache-Control','no-store')
  return menuToday()
})
