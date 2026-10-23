import { defineEventHandler, setHeader } from 'h3'
import { requireVisitor, visitorName } from '../../utils/auth'
import { isStoreOpen } from '../../utils/store'
// storeOpen lets the page start a visit on the street when the store is closed.
export default defineEventHandler(event => {
  const visitor = requireVisitor(event)
  setHeader(event, 'Cache-Control', 'no-store')
  return { nickname: visitorName(visitor), avatar: visitor.avatar_key, storeOpen: isStoreOpen() }
})
