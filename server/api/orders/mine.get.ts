import { defineEventHandler, setHeader } from 'h3'
import { requireVisitor } from '../../utils/auth'
import { orderInbox } from '../../utils/customer-orders'

export default defineEventHandler(event=>{
  const visitor=requireVisitor(event)
  setHeader(event,'Cache-Control','no-store')
  return orderInbox(visitor.id)
})
