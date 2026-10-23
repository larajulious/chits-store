import {MAX_VIEW_W,scenes} from './world'

// Traffic on the street, in twenty-second slots of the clock, so everyone on the street (and the server) agrees which
// vehicle is where. Every third slot brings a jeepney, so one stops about once a minute: it comes along the near lane
// and waits at the jeepney stop, which is when visitors can board. About half the other slots bring a car or a
// tricycle, either way. Paint and direction come from the slot. x is the vehicle's middle, in world units.
export type VehicleKind='car'|'jeepney'|'tricycle'
export const TRAFFIC_SLOT_MS=20_000
// The stop is on the near pavement in front of the store: a jeepney stops with its middle at x, and visitors board at
// its rear door from the pavement spot (boardX, boardY).
export const JEEPNEY_STOP={x:360,boardX:280,boardY:500,dwellMs:10_000,reach:90}
const DRIVE_MS:Record<VehicleKind,number>={car:6000,jeepney:8000,tricycle:9500}

// Vehicles appear and leave past the widest view, with room for the longest (a jeepney) to be out of sight.
const W=scenes.outside.width,EDGE=(MAX_VIEW_W-W)/2+100
function mix32(value:number){
  let h=Math.imul(value^0x9e3779b9,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);h^=h>>>16
  return h>>>0
}
export type TrafficPass={id:number;kind:VehicleKind;rightward:boolean;paint:number;x:number;stopped:boolean}
export function trafficAt(now:number):TrafficPass|undefined{
  const slot=Math.floor(now/TRAFFIC_SLOT_MS),seed=mix32(slot^0x5bd1e995),jeepney=slot%3===0
  if(!jeepney&&seed%100>=55)return undefined
  const kind:VehicleKind=jeepney?'jeepney':(seed>>>4)%2?'car':'tricycle',rightward=jeepney||((seed>>>12)&1)===0
  const drive=DRIVE_MS[kind],total=drive+(jeepney?JEEPNEY_STOP.dwellMs:0)
  const t=now-slot*TRAFFIC_SLOT_MS-(seed>>>8)%(TRAFFIC_SLOT_MS-total)
  if(t<0||t>total)return undefined
  const from=rightward?-EDGE:W+EDGE,to=rightward?W+EDGE:-EDGE,pass={id:slot,kind,rightward,paint:(seed>>>16)%4,stopped:false}
  if(!jeepney)return {...pass,x:from+(to-from)*t/drive}
  // A jeepney slows into the stop, waits, then pulls away and speeds up.
  const stop=JEEPNEY_STOP.x,inMs=drive*(stop-from)/(to-from),outMs=drive-inMs
  if(t<inMs){const p=t/inMs;return {...pass,x:from+(stop-from)*(1-(1-p)**2)}}
  if(t<inMs+JEEPNEY_STOP.dwellMs)return {...pass,x:stop,stopped:true}
  const p=(t-inMs-JEEPNEY_STOP.dwellMs)/outMs
  return {...pass,x:stop+(to-stop)*p*p}
}
// Whether a jeepney is waiting at the stop (allowing a moment either side for the network).
export function jeepneyAtStop(now:number,graceMs=0){
  return [now,now-graceMs,now+graceMs].some(t=>{const pass=trafficAt(t);return pass?.kind==='jeepney'&&pass.stopped})
}
