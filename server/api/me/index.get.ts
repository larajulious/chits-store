import { defineEventHandler, setHeader } from 'h3'
import { requireVisitor, visitorName } from '../../utils/auth'
import { isStoreOpen } from '../../utils/store'
// storeOpen lets the page start a visit on the street when the store is closed; name is the visitor's own chosen
// name ('' for the food buddy's), for the name dialog.
export default defineEventHandler(event => {
  const visitor = requireVisitor(event)
  setHeader(event, 'Cache-Control', 'no-store')
  return { nickname: visitorName(visitor), name: visitor.nickname ?? '', avatar: visitor.avatar_key, storeOpen: isStoreOpen() }
})
