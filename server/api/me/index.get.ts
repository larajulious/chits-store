import { defineEventHandler, setHeader } from 'h3'
import { requireVisitor, visitorName } from '../../utils/auth'
export default defineEventHandler(event => {
  const visitor = requireVisitor(event)
  setHeader(event, 'Cache-Control', 'no-store')
  return { nickname: visitorName(visitor), avatar: visitor.avatar_key }
})
