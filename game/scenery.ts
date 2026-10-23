// The Tanaw Deck sky: a mountain-and-lake view whose colours follow the store's Manila clock through the day.
// Pure numbers only (no Phaser), so the café scene can draw it and the tests can check it.
export type SkyPhase='morning'|'afternoon'|'sunset'|'night'
export type Sky={
  top:number;mid:number;horizon:number
  // Mountain layers far to near, the lake, and the colour of the sun or moon's halo.
  far:number;island:number;lake:number;near:number;glow:number
  // 0..1: sunset light spilling onto the deck and into the café, night shade, lamps on, stars out, morning mist.
  warmth:number;dark:number;lights:number;stars:number;fog:number
}
type Keyframe=Sky&{at:number}
const NIGHT:Sky={top:0x141a33,mid:0x1f2a4d,horizon:0x34406b,far:0x2b3556,island:0x232c47,lake:0x2a3a5e,near:0x1a2a2a,glow:0xdfe8ff,warmth:0,dark:.55,lights:1,stars:1,fog:.1}
// Minutes after midnight. Between two keyframes every colour blends evenly, so the view changes a little each minute.
const KEYFRAMES:readonly Keyframe[]=[
  {at:0,...NIGHT},
  {at:300,top:0x1a2140,mid:0x2a3459,horizon:0x4a4f7a,far:0x323a5e,island:0x2a3150,lake:0x34426a,near:0x1e2e2e,glow:0xdfe8ff,warmth:0,dark:.5,lights:1,stars:.8,fog:.3},
  {at:345,top:0x3d4a7a,mid:0x8a7aa8,horizon:0xf0a98a,far:0x6a6a90,island:0x575a7d,lake:0x8c86a8,near:0x2e4236,glow:0xffc49a,warmth:.35,dark:.25,lights:.6,stars:.2,fog:.8},
  {at:420,top:0x6fa8dc,mid:0x9cc8e8,horizon:0xf3dcc0,far:0x8fa6c4,island:0x7a8fae,lake:0x9cc0d8,near:0x4f7a4a,glow:0xfff0c8,warmth:.15,dark:0,lights:0,stars:0,fog:.7},
  {at:600,top:0x5e9fe0,mid:0x8cc4ef,horizon:0xd6ecf7,far:0x8fb0cf,island:0x6f8fa8,lake:0x7fb6dc,near:0x4f8a48,glow:0xfffbe0,warmth:0,dark:0,lights:0,stars:0,fog:.25},
  {at:840,top:0x4f93dc,mid:0x80bdee,horizon:0xcfe7f5,far:0x86a9cb,island:0x6a8ca6,lake:0x74afd9,near:0x4c8746,glow:0xfffbe0,warmth:0,dark:0,lights:0,stars:0,fog:.1},
  {at:960,top:0x5a8fd0,mid:0x9fc0e0,horizon:0xf2dcb0,far:0x8e9fbe,island:0x75809e,lake:0x8fb0cc,near:0x4c7a40,glow:0xffe6a8,warmth:.25,dark:0,lights:0,stars:0,fog:.1},
  {at:1035,top:0x5d6fb0,mid:0xd99a7a,horizon:0xffc06a,far:0x8a6f8e,island:0x6e5a78,lake:0xd8a07a,near:0x3e5a36,glow:0xffb050,warmth:.7,dark:0,lights:.3,stars:0,fog:.15},
  {at:1070,top:0x3e4a8a,mid:0xd9707a,horizon:0xff9a4a,far:0x6e4f78,island:0x5a4064,lake:0xc8785e,near:0x2f4630,glow:0xff8a3a,warmth:1,dark:.1,lights:.6,stars:.05,fog:.1},
  {at:1110,top:0x232a5a,mid:0x5a4a82,horizon:0xb06a7a,far:0x3e3c62,island:0x33324f,lake:0x4f4a72,near:0x1f3128,glow:0xffc0a0,warmth:.35,dark:.35,lights:1,stars:.5,fog:.1},
  {at:1170,...NIGHT,top:0x161c38,mid:0x222c52,horizon:0x3a4570,lake:0x2c3c62,fog:.05},
  {at:1440,...NIGHT},
]
const COLORS=['top','mid','horizon','far','island','lake','near','glow'] as const
const AMOUNTS=['warmth','dark','lights','stars','fog'] as const
export function mixColor(a:number,b:number,t:number){
  let out=0
  for(const shift of [16,8,0])out|=Math.round(((a>>shift)&255)+(((b>>shift)&255)-((a>>shift)&255))*t)<<shift
  return out
}
export function skyAt(minute:number):Sky{
  const m=((minute%1440)+1440)%1440
  // The first keyframe is at 0 and the last at 1440, so every minute falls between two of them.
  const next=KEYFRAMES.findIndex(frame=>frame.at>m),a=KEYFRAMES[next-1]!,b=KEYFRAMES[next]!
  const t=(m-a.at)/(b.at-a.at)
  const sky={} as Sky
  for(const key of COLORS)sky[key]=mixColor(a[key],b[key],t)
  for(const key of AMOUNTS)sky[key]=Math.round((a[key]+(b[key]-a[key])*t)*100)/100
  return sky
}
// The mood of the hour, for the deck's little thoughts and the barista's small talk.
export function skyPhase(minute:number):SkyPhase{
  const m=((minute%1440)+1440)%1440
  return m>=300&&m<660?'morning':m>=660&&m<1005?'afternoon':m>=1005&&m<1110?'sunset':'night'
}
// Where the sun and the moon sit, as 0..1 across their arcs (rising on the left, setting behind the right-hand ridge);
// undefined while below the horizon.
export function sunArc(minute:number){const m=((minute%1440)+1440)%1440;return m>=330&&m<=1095?(m-330)/(1095-330):undefined}
export function moonArc(minute:number){const m=((minute%1440)+1440)%1440,since=(m-1080+1440)%1440;return since<=720?since/720:undefined}
export function manilaMinute(now=new Date()){
  const [hour,minute]=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Manila',hour:'numeric',minute:'numeric',hourCycle:'h23'}).format(now).split(':').map(Number)
  return (hour!%24)*60+minute!
}
// ?time= previews on the store page: a fixed minute for each named time of day.
export const SKY_PREVIEW:Record<string,number>={morning:450,day:600,afternoon:840,dusk:1060,sunset:1065,night:1290}
