import {defineEventHandler,setHeader} from 'h3'
import {requireAdmin} from '../../../utils/auth'
import {adminFeedback} from '../../../utils/feedback'
export default defineEventHandler(event=>{
  requireAdmin(event)
  setHeader(event,'Cache-Control','no-store')
  return adminFeedback()
})
