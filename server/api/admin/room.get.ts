import { defineEventHandler, setHeader } from 'h3'
import { requireAdmin } from '../../utils/auth'
import { roomAdminState } from '../../utils/room'
export default defineEventHandler(event => {
  requireAdmin(event)
  setHeader(event, 'Cache-Control', 'no-store')
  return roomAdminState()
})
