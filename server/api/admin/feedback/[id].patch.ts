import {defineEventHandler,createError,getRouterParam,setHeader} from 'h3'
import {requireAdmin,verifyOrigin} from '../../../utils/auth'
import {readJsonBody} from '../../../utils/body'
import {adminFeedback,moderateFeedback} from '../../../utils/feedback'
import {broadcast} from '../../../utils/room'
export default defineEventHandler(async event=>{
  requireAdmin(event);verifyOrigin(event)
  const id=Number(getRouterParam(event,'id'))
  if(!Number.isSafeInteger(id)||id<1)throw createError({statusCode:400,statusMessage:'Invalid feedback ID'})
  const body=await readJsonBody<{action?:unknown}>(event)
  moderateFeedback(id,body.action)
  broadcast({type:'feedback_changed'})
  setHeader(event,'Cache-Control','no-store')
  return adminFeedback()
})
