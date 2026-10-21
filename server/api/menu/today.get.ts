import { defineEventHandler, setHeader } from 'h3'
import { menuToday } from '../../utils/menu'

export default defineEventHandler(event=>{
  setHeader(event,'Cache-Control','no-store')
  return menuToday()
})
