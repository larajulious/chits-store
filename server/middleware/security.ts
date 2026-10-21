import { defineEventHandler, setHeaders } from 'h3'
export default defineEventHandler(event=>{
  setHeaders(event,{'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Permissions-Policy':'camera=(), microphone=(), geolocation=()'})
})
