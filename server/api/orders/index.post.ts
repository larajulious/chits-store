import { defineEventHandler, setHeader } from 'h3'
import { readJsonBody } from '../../utils/body'
import { requireVisitor, verifyOrigin } from '../../utils/auth'
import { requireStoreOpen } from '../../utils/store'
import { createCustomerOrder, orderDetail } from '../../utils/customer-orders'

export default defineEventHandler(async event=>{
  const visitor=requireVisitor(event);verifyOrigin(event);requireStoreOpen()
  const body=await readJsonBody<{items?:unknown}>(event)
  const order=createCustomerOrder(visitor.id,body.items)
  setHeader(event,'Cache-Control','no-store')
  return orderDetail(order.id,visitor.id)
})
