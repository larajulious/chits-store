import { createError } from 'h3'
import { db } from './db'

export function isStoreOpen():boolean{
  const row=db().prepare('SELECT is_open FROM store_settings WHERE id=1').get() as {is_open:number}
  return row.is_open===1
}

export function requireStoreOpen(){
  if(!isStoreOpen())throw createError({statusCode:503,statusMessage:'Chits Meryenda Hub is closed right now. Please come back soon.'})
}

export function setStoreOpen(open:boolean){
  db().prepare('UPDATE store_settings SET is_open=? WHERE id=1').run(open?1:0)
  return {open}
}
