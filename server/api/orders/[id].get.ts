import { defineEventHandler, getRouterParam, setHeader } from 'h3'
import { requireVisitor } from '../../utils/auth'
import { orderDetail, validOrderId } from '../../utils/customer-orders'

export default defineEventHandler(event=>{
  const visitor=requireVisitor(event)
  setHeader(event,'Cache-Control','no-store')
  return orderDetail(validOrderId(getRouterParam(event,'id')),visitor.id)
})
