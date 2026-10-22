import { defineEventHandler, getRouterParam, setHeader } from 'h3'
import { requireVisitor, verifyOrigin } from '../../../utils/auth'
import { requireStoreOpen } from '../../../utils/store'
import { readJsonBody } from '../../../utils/body'
import { postOrderMessage, validOrderId } from '../../../utils/customer-orders'

export default defineEventHandler(async event=>{
  const visitor=requireVisitor(event);verifyOrigin(event);requireStoreOpen()
  const id=validOrderId(getRouterParam(event,'id'))
  const body=await readJsonBody<{text?:unknown}>(event)
  setHeader(event,'Cache-Control','no-store')
  return postOrderMessage(id,'visitor',body.text,visitor.id)
})
