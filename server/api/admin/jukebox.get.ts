import { defineEventHandler, setHeader } from 'h3'
import { requireAdmin } from '../../utils/auth'
import { jukeboxAdminState } from '../../utils/jukebox'
export default defineEventHandler(event => {
  requireAdmin(event)
  setHeader(event, 'Cache-Control', 'no-store')
  return jukeboxAdminState()
})
