import { defineEventHandler, getRouterParam, setHeader } from 'h3'
import { requireAdmin, verifyOrigin } from '../../../../utils/auth'
import { requireStoreOpen } from '../../../../utils/store'
import { readJsonBody } from '../../../../utils/body'
import { postOrderMessage, validOrderId } from '../../../../utils/customer-orders'

export default defineEventHandler(async event=>{
  requireAdmin(event);verifyOrigin(event);requireStoreOpen()
  const id=validOrderId(getRouterParam(event,'id'))
  const body=await readJsonBody<{text?:unknown}>(event)
  setHeader(event,'Cache-Control','no-store')
  return postOrderMessage(id,'staff',body.text)
})
