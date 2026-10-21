import { createError, defineEventHandler, setHeader } from 'h3'
import { requireAdmin, verifyOrigin } from '../../utils/auth'
import { readJsonBody } from '../../utils/body'
import { db } from '../../utils/db'
import { todayInManila } from '../../utils/menu'
import { broadcast, clearChatHistory, resetVisitorRoom } from '../../utils/room'

const resetOptions=['menu','orders','feedback','chat','visitors'] as const
type ResetOption=typeof resetOptions[number]
export default defineEventHandler(async event=>{
  requireAdmin(event)
  verifyOrigin(event)
  const body=await readJsonBody<{options?:unknown;confirmation?:unknown}>(event)
  if(!Array.isArray(body.options)||body.options.length===0||body.options.length>resetOptions.length||
    body.options.some((option:unknown)=>!resetOptions.includes(option as ResetOption))||
    new Set(body.options).size!==body.options.length)
    throw createError({statusCode:400,statusMessage:'Select valid data to reset'})
  if(body.confirmation!=='RESET')throw createError({statusCode:400,statusMessage:'Type RESET to confirm'})

  const selected=new Set<ResetOption>(body.options)
  const connection=db()
  connection.transaction(()=>{
    if(selected.has('menu'))connection.prepare('DELETE FROM daily_menu WHERE service_date=?').run(todayInManila())
    if(selected.has('orders')){
      connection.prepare('DELETE FROM orders').run()
      connection.prepare('DELETE FROM order_sequence').run()
    }
    if(selected.has('feedback'))connection.prepare('DELETE FROM feedback').run()
    // Keep AUTOINCREMENT counters so an old cookie can never refer to a new visitor.
    if(selected.has('visitors'))connection.prepare('DELETE FROM visitors').run()
  }).immediate()

  if(selected.has('visitors'))resetVisitorRoom()
  if(selected.has('chat'))clearChatHistory()
  if(selected.has('menu'))broadcast({type:'menu_changed'})
  if(selected.has('orders'))broadcast({type:'order_changed'})
  if(selected.has('feedback'))broadcast({type:'feedback_changed'})
  setHeader(event,'Cache-Control','no-store')
  return {reset:resetOptions.filter(option=>selected.has(option))}
})
