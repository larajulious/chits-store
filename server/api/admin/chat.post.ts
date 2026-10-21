import {defineEventHandler,createError,setHeader} from 'h3'
import {requireAdmin,verifyOrigin} from '../../utils/auth'
import {readJsonBody} from '../../utils/body'
import {adminChatState,isChatEnabled,publishChat} from '../../utils/room'
import {requireStoreOpen} from '../../utils/store'

let lastSentAt=0,windowStart=0,count=0
export default defineEventHandler(async event=>{
  requireAdmin(event);verifyOrigin(event)
  const body=await readJsonBody<{text?:unknown}>(event)
  if(typeof body.text!=='string')throw createError({statusCode:400,statusMessage:'Message text is required'})
  const text=body.text.normalize('NFKC').replace(/[\p{C}]/gu,'').trim()
  if(!text||text.length>160)throw createError({statusCode:400,statusMessage:'Use 1–160 characters for your message'})
  requireStoreOpen()
  if(!isChatEnabled())throw createError({statusCode:403,statusMessage:'Enable public chat before sending a message'})
  const now=Date.now()
  if(now-windowStart>=60_000){windowStart=now;count=0}
  if(now-lastSentAt<1500||count>=20)throw createError({statusCode:429,statusMessage:'Please wait before sending another message'})
  lastSentAt=now;count++
  publishChat({id:'staff',nickname:'Chits Store',role:'staff',text,at:now})
  setHeader(event,'Cache-Control','no-store')
  return adminChatState()
})
