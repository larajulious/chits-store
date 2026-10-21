import { defineEventHandler } from 'h3'
import { clearAdmin, verifyOrigin } from '../../utils/auth'
export default defineEventHandler(event => { verifyOrigin(event); clearAdmin(event); return { ok:true } })
