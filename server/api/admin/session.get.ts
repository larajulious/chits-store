import { defineEventHandler } from 'h3'
import { isAdmin } from '../../utils/auth'
export default defineEventHandler(event => ({ authenticated:isAdmin(event) }))
