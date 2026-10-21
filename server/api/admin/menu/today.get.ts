import { defineEventHandler, setHeader } from 'h3'
import { requireAdmin } from '../../../utils/auth'
import { menuToday } from '../../../utils/menu'

export default defineEventHandler(event=>{
  requireAdmin(event)
  setHeader(event,'Cache-Control','no-store')
  return menuToday()
})
