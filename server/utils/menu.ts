import { createError } from 'h3'
import { createHash } from 'node:crypto'
import { db } from './db'

type MenuRow = { id:number; name:string; price_centavos:number }

export function todayInManila() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone:'Asia/Manila', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(new Date())
  const value = (type:string) => parts.find(part=>part.type===type)?.value
  return `${value('year')}-${value('month')}-${value('day')}`
}

export function menuToday() {
  const date = todayInManila()
  const rows = db().prepare('SELECT id,name,price_centavos FROM daily_menu WHERE service_date=? ORDER BY id').all(date) as MenuRow[]
  const items=rows.map(row=>({ id:row.id, name:row.name, priceCentavos:row.price_centavos }))
  const version=createHash('sha256').update(JSON.stringify({date,items})).digest('hex').slice(0,16)
  return { date, version, items }
}

export function menuItemInput(body:{name?:unknown;priceCentavos?:unknown}) {
  const name=typeof body.name==='string'?body.name.trim().replace(/\s+/gu,' '):''
  if(!name||name.length>60||/[\p{Cc}\p{Cf}]/u.test(name))throw createError({statusCode:400,statusMessage:'Enter a menu item name up to 60 characters'})
  const priceCentavos=body.priceCentavos
  if(!Number.isSafeInteger(priceCentavos)||Number(priceCentavos)<1||Number(priceCentavos)>1_000_000)throw createError({statusCode:400,statusMessage:'Enter a price between ₱0.01 and ₱10,000.00'})
  return {name,priceCentavos:priceCentavos as number}
}

export function menuItemId(value:unknown) {
  if(!Number.isSafeInteger(value)||Number(value)<1)throw createError({statusCode:400,statusMessage:'Invalid menu item ID'})
  return value as number
}
