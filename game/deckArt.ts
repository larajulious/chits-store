import {avatarOptions} from '../shared/avatars'
import {INK,LEAF,LEAF_DARK,LEAF_LIGHT,PixelArt,WOOD,WOOD_DARK,WOOD_DEEP,WOOD_LIGHT,headArt} from './pixelArt'

// The Tanaw Deck beside Kape & Chits: an open-air deck facing layered mountains and a lake with a small volcano island.
// The view layers are drawn in greys and tinted by the scene for the time of day (see scenery.ts), so one texture
// serves the morning, the sunset and the moonlit night. World x 360..1260: the deck's 360 units plus the widest view.
export const VIEW_LEFT=360,VIEW_ART_W=450
const noise=(x:number,y:number)=>((x*73856093)^(y*19349663))>>>0
const hex=(value:number)=>`#${value.toString(16).padStart(6,'0')}`
const cone=(x:number,center:number,width:number,height:number)=>height*Math.max(0,1-Math.abs(x-center)/width)**1.4
type HeadId=Parameters<typeof headArt>[0]

// Far ridge: a long range with a broad peak on the left and a sharper one where the sun sets.
export function farRidgeArt(){
  const art=new PixelArt(VIEW_ART_W,44)
  for(let x=0;x<VIEW_ART_W;x++){
    const height=14+7*Math.sin(x/29+.6)+4*Math.sin(x/11+2)+cone(x,46,30,16)+cone(x,160,16,20)+cone(x,300,26,24)+cone(x,410,30,12)
    const top=44-Math.round(Math.max(2,Math.min(40,height)))
    for(let y=top;y<44;y++)art.set(x,y,y===top?'#ffffff':noise(x,y)%9===0&&y>top+2?'#d8d8d8':'#ececec')
  }
  return art
}
// A low volcano island in the lake, with a notch of a crater and a smaller cone beside it.
export function islandArt(){
  const art=new PixelArt(64,16)
  for(let x=0;x<64;x++){
    let height=Math.max(cone(x,34,28,11),cone(x,10,8,4))
    if(Math.abs(x-34)<=3)height-=2
    if(height<.6)continue
    const top=15-Math.round(height)
    for(let y=top;y<15;y++)art.set(x,y,y===top?'#ffffff':(x+y)%7===0?'#d4d4d4':'#e6e6e6')
  }
  return art.rect(0,15,64,1,'#f6f6f6')
}
// Near hills: the treed slope below the deck, high on the left, dipping in the middle so the lake shows.
export function nearHillsArt(){
  const art=new PixelArt(VIEW_ART_W,52),tops:number[]=[]
  for(let x=0;x<VIEW_ART_W;x++){
    const ground=x<70?8+x*.42:x<150?37+Math.sin((x-70)/80*Math.PI)*3:Math.max(12,37-(x-150)*.22)
    tops.push(Math.round(ground))
    for(let y=Math.round(ground)+2;y<52;y++)art.set(x,y,noise(x,y)%11===0?'#bdbdbd':'#d4d4d4')
  }
  // Tree crowns along the ridge line, lit from the top left.
  for(let x=2;x<VIEW_ART_W;x+=6+noise(x,3)%3){
    const r=3+noise(x,7)%3,cy=tops[x]!+r-1
    art.ellipse(x,cy,r,r-.5,'#e4e4e4').ellipse(x-1,cy-1,r-1.5,r-2,'#f4f4f4').set(x-1,cy-r+1,'#ffffff')
  }
  return art
}
// Treetops filling the hillside beyond the deck's right edge, seen on wide screens.
export function hillsideArt(){
  const art=new PixelArt(270,146).rect(0,0,270,146,'#cfcfcf')
  for(let y=4;y<146;y+=9)for(let x=(y*7)%11;x<270;x+=12){
    const r=6+noise(x,y)%3
    art.ellipse(x,y,r,r-1,'#e2e2e2').ellipse(x-1,y-2,r-3,r-4,'#f2f2f2').set(x-2,y-r+1,'#ffffff')
  }
  return art
}
export function cloudArt(){
  return new PixelArt(32,11).ellipse(10,7,8,3.5,'#ffffff').ellipse(18,5,8,4.5,'#ffffff').ellipse(25,7,6,3,'#ffffff').rect(4,9,26,1,'#e6e6e6')
}
export function sunArt(){return new PixelArt(14,14).ellipse(7,7,6.5,6.5,'#fff6dc').ellipse(7,7,5,5,'#ffffff')}
export function moonArt(){
  const art=new PixelArt(12,12).ellipse(6,6,5.5,5.5,'#f6f1de')
  for(const [x,y] of [[4,4],[7,7],[8,3],[3,7]] as const)art.set(x,y,'#ddd5bb')
  return art.set(5,4,'#ddd5bb').set(7,8,'#ddd5bb').set(3,3,'#ffffff')
}

// The deck itself, from the railing (world y 300) to the bottom edge: rail with balusters, weathered planks,
// a side rail on the right and a planter of shrubs along the front.
export function deckFloorArt(){
  const art=new PixelArt(180,140),planks=['#b78a62','#ad7f58','#c09469']
  for(let y=12;y<124;y++){
    const row=Math.floor((y-12)/6),offset=(row*17)%36
    for(let x=0;x<180;x++){
      const seam=(y-12)%6===5||(x+offset)%36===0,n=noise(x,y)%29
      art.set(x,y,seam?'#86603f':n===0?'#9c7050':n===1?'#cfa47a':planks[row%3]!)
    }
  }
  // Railing: posts, a top rail, balusters and a kick board. The hills show between the balusters.
  for(let x=2;x<174;x+=4)art.rect(x,5,1,5,WOOD_DARK)
  art.rect(0,2,176,1,WOOD_LIGHT).rect(0,3,176,2,WOOD).rect(0,5,176,1,WOOD_DARK).rect(0,10,176,2,WOOD_DEEP).rect(0,10,176,1,WOOD_DARK)
  for(let x=8;x<174;x+=30)art.rect(x,0,3,12,WOOD).rect(x,0,3,1,WOOD_LIGHT).rect(x+2,1,1,11,WOOD_DARK)
  // Side rail down the right edge, seen from above.
  art.rect(174,0,6,124,WOOD).rect(174,0,1,124,WOOD_LIGHT).rect(179,0,1,124,WOOD_DEEP)
  for(let y=0;y<124;y+=28)art.rect(173,y,7,3,WOOD_LIGHT).rect(173,y+2,7,1,WOOD_DARK)
  // Front planter: a wooden box with a low hedge spilling over its top.
  art.rect(0,126,180,14,'#8a5c3a').rect(0,126,180,1,WOOD_LIGHT).rect(0,127,180,1,WOOD_DARK).rect(0,138,180,2,'#6e4a31')
  for(let x=8;x<180;x+=16)art.rect(x,128,1,10,'#7a4f31')
  for(let x=3;x<180;x+=7){const r=3+noise(x,1)%2;art.ellipse(x,125,r,2.6,LEAF_DARK).ellipse(x-.5,124.4,r-1,1.8,LEAF).set(x-1,123,LEAF_LIGHT)}
  for(const x of [20,64,118,160])art.set(x,123,'#f3a09c').set(x+1,124,'#fff1b0')
  return art
}
// The wall between the café and the deck, seen from above: the end of the back wall, then a thin wall with
// a doorway (world y 372..452) through to the deck.
export const DOORWAY={top:372,bottom:452}
export function partitionArt(){
  const art=new PixelArt(8,290),gapTop=DOORWAY.top/2,gapBottom=DOORWAY.bottom/2
  art.rect(0,0,8,101,'#e2cfae').rect(0,0,1,101,'#c9b48f').rect(7,0,1,101,'#c9b48f').rect(0,0,8,4,WOOD_DEEP).rect(0,76,8,23,'#8a5c3a').rect(0,76,8,1,WOOD_LIGHT).rect(0,99,8,2,WOOD_DEEP)
  for(let y=101;y<274;y++){
    if(y>=gapTop&&y<gapBottom)continue
    art.set(0,y,INK).rect(1,y,1,1,WOOD_LIGHT).rect(2,y,4,1,'#8a5c3a').rect(6,y,1,1,'#6b4630').set(7,y,INK)
  }
  for(const y of [gapTop-4,gapBottom])art.box(0,y,8,4,WOOD_DARK,INK).rect(1,y+1,6,1,WOOD)
  return art.rect(0,274,8,16,'#6e4a31').rect(0,274,8,1,'#6b4630')
}
// A small hanging sign over the doorway, pointing out to the deck.
export function deckSignArt(){
  const art=new PixelArt(38,12)
  art.set(5,0,INK).set(32,0,INK).set(5,1,INK).set(32,1,INK)
  art.box(0,2,38,10,'#6b4630',INK).rect(1,3,36,1,'#86593b')
  return art
}
// String-light post at a corner of the railing.
export function lightPostArt(){
  return new PixelArt(4,48).rect(1,2,2,46,WOOD_DARK).rect(1,2,1,46,WOOD).rect(0,0,4,2,WOOD_DEEP).outline(INK)
}
// A bench facing the view, seen from behind: the seat (under whoever sits) and the backrest (in front of them).
export function benchSeatArt(){
  const art=new PixelArt(40,7)
  art.rect(1,0,38,2,WOOD_LIGHT).rect(1,2,38,2,WOOD).rect(1,4,38,1,WOOD_DARK).rect(3,5,2,2,WOOD_DEEP).rect(35,5,2,2,WOOD_DEEP)
  return art.outline(INK)
}
export function benchBackArt(){
  const art=new PixelArt(40,9)
  art.rect(2,0,2,9,WOOD_DARK).rect(36,0,2,9,WOOD_DARK)
  art.rect(1,1,38,2,WOOD).rect(1,1,38,1,WOOD_LIGHT).rect(1,4,38,2,WOOD).rect(1,4,38,1,WOOD_LIGHT).rect(1,6,38,1,WOOD_DARK)
  return art.outline(INK).shadow(20,8.6,18,1)
}

// A visitor seen from behind, looking out at the view: standing, leaning on the rail (head a pixel lower,
// forearms on the rail out of sight), or sitting on a bench (the backrest hides everything below the waist).
// The same green shirt as the front-facing visitor, with the apron's bow tied at the back.
export type BackPose='stand'|'lean'|'sit'
export function backVisitorArt(id:HeadId,pose:BackPose,wave=false){
  const option=avatarOptions.find(a=>a.id===id),skin=option?hex(option.body):'#f3cf82'
  const body=new PixelArt(20,26),drop=pose==='lean'?1:0,tie='#f8f3e6'
  body.rect(5,14+drop,10,7-drop,'#5fa058').rect(14,15+drop,1,6-drop,'#4c8747')
  body.rect(5,18,10,1,tie).set(9,17,tie).set(10,17,tie).set(8,19,tie).set(11,19,tie)
  const arm=pose==='lean'?2:3
  body.rect(3,16,2,arm,skin)
  if(wave)body.rect(15,10,2,5,skin);else body.rect(15,16,2,arm,skin)
  if(pose!=='sit')body.rect(6,21,3,2,'#4a7d45').rect(6,23,3,1,'#5a3b27').rect(11,21,3,2,'#4a7d45').rect(11,23,3,1,'#5a3b27')
  body.outline(INK)
  body.stamp(headArt(id,false,false),0,drop)
  return pose==='sit'?body:body.shadow(10,25,7,1.2)
}

// Umbrellas for the rainy mood, in the café's sage-and-cream awning stripes. The patio umbrella opens over a bench or
// the deck's table (its pole stands between the two seats); the small one is held by visitors out in the open.
const STRIPES=['#5f7f5c','#f6ead2'],STRIPE_SHADE=['#4f6d55','#e2d3b5']
function canopy(art:PixelArt,cx:number,rows:number,halfWidth:(row:number)=>number,stripe:number){
  for(let y=0;y<rows;y++){
    const half=Math.round(halfWidth(y))
    for(let x=cx-half;x<cx+half;x++){const band=Math.floor((x-cx+64)/stripe)%2;art.set(x,y,y>=rows-2?STRIPE_SHADE[band]!:STRIPES[band]!)}
  }
  // Scalloped hem: one dip per stripe.
  const half=Math.round(halfWidth(rows-1))
  for(let x=cx-half;x<cx+half;x++)if((x-cx+64)%stripe!==0&&(x-cx+64)%stripe!==stripe-1)art.set(x,rows,STRIPE_SHADE[Math.floor((x-cx+64)/stripe)%2]!)
}
export function patioUmbrellaArt(){
  const art=new PixelArt(52,40)
  art.rect(25,12,2,28,WOOD_DARK).rect(25,12,1,28,WOOD)
  canopy(art,26,13,y=>Math.min(25,4+y*2),6)
  art.rect(25,0,2,1,WOOD_DEEP)
  return art.outline(INK)
}
export function handUmbrellaArt(){
  const art=new PixelArt(22,19)
  art.rect(15,6,1,12,WOOD_DARK).set(14,18,WOOD_DARK).set(13,17,WOOD_DARK)
  canopy(art,11,6,y=>Math.min(10,3+y*1.6),4)
  return art.outline(INK)
}
