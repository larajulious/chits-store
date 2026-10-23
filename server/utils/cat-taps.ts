import { db } from './db'
import { broadcast } from './room'
import { residentCats, type CatName, type CatTaps } from '../../shared/store-mascot'

// One store-wide tally per cat ("1,234 meows and counting"). Every tap is written to SQLite straight
// away, so restarts never lose one, and no admin reset touches the table: the count only goes up.
// Totals are announced at most every BROADCAST_MS so a flurry of taps is one message per window.
const BROADCAST_MS=250,TAP_COOLDOWN_MS=50

let broadcastTimer:ReturnType<typeof setTimeout>|undefined
const lastTapAt=new Map<number,number>()

export function isCatName(value:unknown):value is CatName{return residentCats.some(cat=>cat.name===value)}
export function catTaps():CatTaps{
  const taps=Object.fromEntries(residentCats.map(cat=>[cat.name,0])) as CatTaps
  for(const row of db().prepare('SELECT name,count FROM cat_taps').all() as {name:string;count:number}[])if(isCatName(row.name))taps[row.name]=row.count
  return taps
}
// Faster than a person can tap is dropped, per visitor, so a script can't run the count up.
export function tapCat(visitorId:number,name:CatName){
  const now=Date.now()
  if(now-(lastTapAt.get(visitorId)??0)<TAP_COOLDOWN_MS)return false
  lastTapAt.set(visitorId,now)
  db().prepare('INSERT INTO cat_taps(name,count) VALUES(?,1) ON CONFLICT(name) DO UPDATE SET count=count+1').run(name)
  broadcastTimer??=setTimeout(()=>{broadcastTimer=undefined;broadcast({type:'cat_taps',taps:catTaps()})},BROADCAST_MS)
  return true
}
