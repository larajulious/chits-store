import {readJsonBody} from '../../../utils/body'
import {defineEventHandler,createError,setHeader} from 'h3'
import {requireAdmin,verifyOrigin} from '../../../utils/auth'
import {closeStoreRoom,reopenStoreRoom} from '../../../utils/room'
import {setStoreOpen} from '../../../utils/store'

export default defineEventHandler(async event=>{
  requireAdmin(event);verifyOrigin(event)
  const body=await readJsonBody<{open?:unknown}>(event)
  if(typeof body.open!=='boolean')throw createError({statusCode:400,statusMessage:'Choose whether the store is open or closed'})
  const state=setStoreOpen(body.open)
  if(state.open)reopenStoreRoom();else closeStoreRoom()
  setHeader(event,'Cache-Control','no-store')
  return state
})
