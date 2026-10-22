import { defineEventHandler, getRouterParam, setHeader } from 'h3'
import { requireAdmin } from '../../../../utils/auth'
import { orderDetail, validOrderId } from '../../../../utils/customer-orders'

export default defineEventHandler(event=>{
  requireAdmin(event)
  setHeader(event,'Cache-Control','no-store')
  return orderDetail(validOrderId(getRouterParam(event,'id')))
})
