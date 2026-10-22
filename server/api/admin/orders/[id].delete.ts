import { defineEventHandler, getRouterParam, setHeader } from 'h3'
import { requireAdmin, verifyOrigin } from '../../../utils/auth'
import { deletePendingCustomerOrder, validOrderId } from '../../../utils/customer-orders'

export default defineEventHandler(event=>{
  requireAdmin(event)
  verifyOrigin(event)
  const id=validOrderId(getRouterParam(event,'id'))
  setHeader(event,'Cache-Control','no-store')
  return deletePendingCustomerOrder(id)
})
