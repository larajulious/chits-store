import {avatarOptions} from '../shared/avatars'
import {vendingProducts} from '../shared/world'
import type {Daylight} from './common'
import {INK,LEAF,LEAF_DARK,LEAF_LIGHT,PixelArt,WOOD,WOOD_DARK,WOOD_DEEP,WOOD_LIGHT,headArt} from './pixelArt'

// Chits Neighborhood art: the same one-art-pixel-per-texture-pixel grid as the store, shown at ART_SCALE.
// The street is 360x290 art pixels (720x580 world units); rows below match the walkable bands in shared/world.ts.
export const STREET={width:360,height:290,facade:126,curb:176,road:182,roadEnd:235,lower:240,hedge:276}
const PAVEMENT='#e3d6c0',PAVEMENT_LINE='#d2c3aa',ASPHALT='#6a6370'
const SHUTTER='#b3afab',SHUTTER_LINE='#9a9692'
// A tiny deterministic hash, so the street's speckles are the same for every visitor.
const noise=(x:number,y:number)=>((x*73856093)^(y*19349663))>>>0

export type {Daylight}
const SKY:Record<Daylight,string[]>={day:['#a9d8ea','#bfe3ef','#d6eef4'],dusk:['#8a74b0','#e59a83','#f6c28f'],night:['#1f2740','#28324f','#33405e']}
// The sky band above the rooftops, drawn behind the street so it can change with the Manila time of day.
export function skyArt(time:Daylight){
  const art=new PixelArt(STREET.width,52)
  SKY[time].forEach((color,i)=>art.rect(0,i*16,STREET.width,i===2?20:16,color))
  if(time==='night')for(let i=0;i<46;i++){const n=noise(i,7);art.set(n%STREET.width,(n>>>9)%40,i%5?'#c9cfe0':'#fff3d6')}
  return art
}
export function cloudArt(){
  return new PixelArt(26,9).ellipse(8,5,6,3.4,'#fffaf0').ellipse(15,4,6.5,3.8,'#fffaf0').ellipse(20,5.5,5,3,'#fffaf0').rect(3,7,20,1,'#e6eef2')
}

function pavement(art:PixelArt,top:number,bottom:number){
  for(let y=top;y<bottom;y++)for(let x=0;x<art.width;x++){
    const n=noise(x,y)%61
    art.set(x,y,x%10===0||(y-top)%10===9?PAVEMENT_LINE:n===0?'#ece1ce':n===1?'#d9cbb3':PAVEMENT)
  }
}
// The ground every part of the street shares: pavement, curbs, asphalt and the hedge along the bottom.
// dashOffset keeps the centre-line dashes in step across neighbouring pieces.
function ground(art:PixelArt,dashOffset:number,skipDashes=(_:number)=>false){
  const width=art.width
  pavement(art,STREET.facade,STREET.curb)
  art.rect(0,STREET.facade,width,2,'#c9b89c')
  art.rect(0,176,width,2,'#f0e6d4').rect(0,178,width,3,'#b9ab94').rect(0,181,width,1,'#8f8270')
  for(let y=STREET.road;y<STREET.roadEnd;y++)for(let x=0;x<width;x++){const n=noise(x,y)%37;art.set(x,y,n===0?'#5d5763':n===1?'#77707d':ASPHALT)}
  art.rect(0,STREET.road,width,1,'#565061').rect(0,STREET.roadEnd-1,width,1,'#565061')
  for(let x=dashOffset%22-22;x<width;x+=22)if(!skipDashes(x))art.rect(x,207,12,2,'#f3e2b8')
  art.rect(0,235,width,2,'#b9ab94').rect(0,237,width,3,'#f0e6d4')
  pavement(art,STREET.lower,STREET.hedge)
  art.rect(0,STREET.hedge,width,14,LEAF_DARK)
  for(let x=0;x<width;x+=8)art.ellipse(x+4,STREET.hedge+1,5,3,LEAF).set(x+3,STREET.hedge-1,LEAF_LIGHT)
  art.rect(0,286,width,4,'#b0684a').rect(0,286,width,1,'#c97f5e')
  for(let x=0;x<width;x+=9)art.set(x,288,'#8e4f37')
}
// Rolling metal shutter of a closed shop, with a paper notice for the scene's "COMING SOON" text.
function shutter(art:PixelArt,x:number){
  art.rect(x-2,72,80,54,'#8e7760').rect(x,74,76,50,SHUTTER).rect(x,74,76,1,'#d4d0cc')
  for(let y=77;y<121;y+=3)art.rect(x,y,76,1,SHUTTER_LINE)
  art.rect(x,121,76,3,'#8a8682').rect(x+34,122,8,1,'#5f5b58')
  art.box(x+18,86,40,18,'#fff8ea','#c9b89a').rect(x+18,86,3,2,'#e9dcc4').rect(x+55,86,3,2,'#e9dcc4')
}
// A neighbor's shop: corrugated tin roof, painted wall and a sign board above the shutter.
function shop(art:PixelArt,x:number,wall:string,shade:string,roof:string,ridge:string,board:string,boardLight:string){
  art.rect(x-2,44,100,8,roof).rect(x-2,44,100,1,'#e8e2d8')
  for(let i=x-2;i<x+98;i+=3)art.rect(i,45,1,6,ridge)
  art.rect(x-2,51,100,1,INK)
  art.rect(x,52,96,74,wall).rect(x,52,96,2,shade).rect(x+94,52,2,74,shade)
  art.box(x+10,56,76,14,board,INK).rect(x+11,57,74,1,boardLight)
  shutter(art,x+10)
}
function storeWindow(art:PixelArt,x:number){
  art.box(x,72,38,40,'#ffe3a3','#b08458').rect(x+1,73,36,1,'#fff1cf').rect(x+18,73,2,38,'#b08458')
  for(const [dx,dy] of [[3,5],[4,4],[5,3],[22,6],[23,5]] as const)art.set(x+dx,72+dy,'#fff8dc')
  // A shelf of kakanin in the window: kutsinta, palitaw, sapin-sapin, puto.
  art.rect(x+1,100,36,2,WOOD_LIGHT).rect(x+1,102,36,1,WOOD)
  for(const [dx,color] of [[3,'#c77836'],[9,'#fff6e5'],[22,'#b28ac5'],[28,'#fff6dc']] as const)art.rect(x+dx,96,5,4,color).rect(x+dx+1,95,3,1,color)
  art.rect(x-2,112,42,3,WOOD_LIGHT).rect(x-2,114,42,1,WOOD)
}
// Fiesta banderitas strung from the store's cornice to a neighbor's roof.
function banderitas(art:PixelArt,x0:number,y0:number,x1:number,y1:number){
  const colors=['#ef6b57','#ffd45e','#5fa058','#7cc4e8','#f3a09c']
  for(let x=Math.min(x0,x1),i=0;x<=Math.max(x0,x1);x++){
    const t=(x-x0)/(x1-x0),y=Math.round(y0+(y1-y0)*t+Math.sin(t*Math.PI)*7)
    art.set(x,y,'#6b5a4a')
    if(x%6===0){const color=colors[i++%colors.length]!;art.rect(x-1,y+1,3,1,color).set(x,y+2,color)}
  }
}

export function streetArt(){
  const art=new PixelArt(STREET.width,STREET.height)
  // Mango trees and rooftops far behind, showing above the neighbors' roofs.
  for(let x=0;x<STREET.width;x++){const h=6+Math.round(3*Math.sin(x*.21)+2*Math.sin(x*.07+1));art.rect(x,46-h,1,h+30,x%23<2?'#7aa865':'#86b86f')}
  // Hollow-block walls at both ends of the street.
  for(const x of [0,350])for(let y=88;y<126;y++)for(let i=x;i<x+10;i++)art.set(i,y,(y-88)%6===0||(i+(Math.floor((y-88)/6)%2)*3)%6===0?'#a8a196':'#c4bdb3')
  // Alleys between the buildings.
  for(const x of [108,240])art.rect(x,52,12,74,'#a3947f').rect(x,52,12,2,'#8e7f6b').rect(x+3,60,2,66,'#8e8a86')
  shop(art,12,'#cfe0bf','#b5c9a4','#9aa3ab','#7f8890','#4f8a83','#6ea8a0')
  shop(art,252,'#efd2c4','#dcb9a9','#b5523f','#93412f',WOOD_DEEP,'#7a5236')
  // Chits Store: cornice, the wooden sign board, a striped awning like the one inside, two warm windows and the door frame.
  art.rect(118,16,124,4,'#6b4630').rect(118,16,124,1,'#83573a')
  art.rect(120,20,120,106,'#f3e0bf').rect(120,20,1,106,'#d9c3a0').rect(239,20,1,106,'#d9c3a0')
  art.box(126,26,108,26,'#7b5236','#4b301f').rect(127,27,106,1,'#946342').rect(127,48,106,3,'#6a442c')
  for(const [x,y,w] of [[136,32,24],[198,45,28],[170,38,16]] as const)art.rect(x,y,w,1,'#714a30')
  for(const [x,y] of [[129,29],[230,29],[129,47],[230,47]] as const)art.set(x,y,'#c9a06c')
  art.rect(118,52,124,2,'#6b4630')
  for(let i=0;i<12;i++){
    const x=120+i*10,color=i%2?'#8e5c3c':'#f6dfb4'
    art.rect(x,54,10,7,color).rect(x+1,61,8,1,color).rect(x+2,62,6,1,color).rect(x,54,10,1,i%2?'#a26c48':'#fff0d2')
    art.set(x,61,'#6b4630').set(x+1,62,'#6b4630').rect(x+2,63,6,1,'#6b4630').set(x+8,62,'#6b4630').set(x+9,61,'#6b4630')
  }
  art.rect(120,64,120,2,'#e2c69c')
  storeWindow(art,127);storeWindow(art,195)
  art.rect(168,78,24,48,'#4b301f').rect(169,79,22,1,'#6b4630')
  art.rect(164,124,32,2,'#cfa97c').rect(164,124,32,1,'#e2c49c')
  banderitas(art,14,42,118,19);banderitas(art,242,19,346,42)
  // Pavement, curb, the street with a crossing to the store, and the far pavement; a trimmed hedge closes off the bottom.
  ground(art,4,x=>x+12>=160&&x<=200)
  for(let k=0;k<8;k++)art.rect(164,186+k*6,32,3,'#efe6d2')
  return art
}

// Where the street carries on past the walkable part, seen on wide screens: two houses behind their own
// gates, and the same road and pavements. Drawn as the left-hand piece (its right edge meets the street);
// the scene mirrors it for the right. EDGE_WINDOWS are the house windows the scene lights at night.
export const EDGE={width:280}
export const EDGE_WINDOWS=[{x:53,y:96},{x:87,y:96},{x:179,y:96},{x:213,y:96}]
function house(art:PixelArt,x:number,wall:string,shade:string,roof:string,ridge:string,trim:string){
  // A two-pitch tin roof, a painted wall, two grilled windows, and a gate in a low hollow-block fence.
  for(let i=0;i<14;i++)art.rect(x-4+i*2,62-i,128-i*4,1,roof)
  for(let i=x;i<x+120;i+=4)art.rect(i,52,1,10,ridge)
  art.rect(x-6,62,132,2,INK)
  art.rect(x,64,120,62,wall).rect(x,64,120,2,shade).rect(x+118,64,2,62,shade)
  for(const wx of [x+14,x+48]){
    art.box(wx,84,26,24,'#ffe3a3',trim).rect(wx+1,85,24,1,'#fff1cf')
    for(let gx=wx+4;gx<wx+24;gx+=5)art.rect(gx,85,1,22,'#5e5a57')
    art.rect(wx-2,108,30,2,trim)
  }
  art.box(x+88,78,22,48,WOOD,WOOD_DARK).rect(x+90,80,18,1,WOOD_LIGHT).set(x+105,102,'#e9b84f')
  for(let fy=112;fy<126;fy++)for(let fx=x-4;fx<x+124;fx++)if(fx<x+84||fx>x+112)art.set(fx,fy,(fy-112)%5===0||(fx+(Math.floor((fy-112)/5)%2)*3)%6===0?'#a8a196':'#c4bdb3')
}
export function streetEdgeArt(){
  const art=new PixelArt(EDGE.width,STREET.height)
  for(let x=0;x<EDGE.width;x++){const h=6+Math.round(3*Math.sin(x*.19+2)+2*Math.sin(x*.05));art.rect(x,46-h,1,h+30,x%29<2?'#7aa865':'#86b86f')}
  house(art,26,'#f2e2b3','#e0cb95','#7f8890','#5f666e',WOOD_DARK)
  house(art,152,'#c6dbe6','#a9c3d1','#b5523f','#93412f','#5e3d27')
  ground(art,(4+EDGE.width)%22)
  return art
}
// A striped sawhorse barricade and big potted plants mark where the walkable street ends.
export function barricadeArt(){
  const art=new PixelArt(30,18)
  art.stroke(5,4,2,17,1,WOOD_DARK,false).stroke(9,4,12,17,1,WOOD_DARK,false).stroke(21,4,18,17,1,WOOD_DARK,false).stroke(25,4,28,17,1,WOOD_DARK,false)
  art.rect(0,3,30,5,'#fff8ea')
  for(let x=0;x<30;x+=6)art.rect(x,3,3,5,'#d9473f')
  art.rect(13,4,4,3,'#ffd45e')
  return art.outline(INK).shadow(15,17.4,14,1)
}
export function bigPotArt(){
  const art=new PixelArt(22,28)
  art.ellipse(11,9,10,8,LEAF_DARK).ellipse(7,8,6,5,LEAF).ellipse(15,6,6,5,LEAF).ellipse(11,4,4,3,LEAF_LIGHT)
  art.rect(4,16,14,10,'#c4744a').rect(3,15,16,3,'#d98a5c').rect(15,18,2,8,'#a85f3a')
  return art.outline(INK).shadow(11,27.4,10,1)
}

// The Chits Store front doors: the same glass-panelled wooden sliding doors visitors see from inside.
// Frames 0..3 slide the two leaves apart into the wall to show the warm shop inside.
export function storeDoorArt(frame:0|1|2|3){
  const art=new PixelArt(20,46),offset=[0,3,6,10][frame]!
  art.rect(0,0,20,30,'#f3e0bf').rect(0,0,20,2,'#fff1cf').rect(0,30,20,16,'#efd5ae')
  for(let x=0;x<20;x+=5)art.rect(x,30,1,16,'#e2c49c')
  art.rect(0,36,20,1,'#e2c49c')
  const leaf=(x:number,handle:number)=>{
    art.rect(x,0,10,46,WOOD).rect(x,0,10,1,WOOD_LIGHT).rect(x,45,10,1,WOOD_DARK)
    art.rect(x+2,3,6,32,'#ffe3a3').rect(x+2,3,6,1,'#fff1cf').rect(x+2,4,2,1,'#fff8dc').set(x+2,5,'#fff8dc')
    art.rect(x+2,38,6,5,WOOD_DARK).rect(x+2,38,6,1,WOOD_LIGHT)
    art.rect(x+handle,19,1,4,'#e9b84f')
  }
  leaf(-offset,8);leaf(10+offset,1)
  return art
}

// The little board hung on the store doors while staff have closed the store; the scene writes CLOSED on it.
export function closedSignArt(){
  const art=new PixelArt(28,15)
  art.set(13,0,'#5e5a57').set(14,0,'#5e5a57')
  for(let i=1;i<5;i++)art.set(13-i*2,i,'#5e5a57').set(14+i*2,i,'#5e5a57')
  art.box(1,5,26,10,'#fff8ea','#ad513f').rect(2,6,24,1,'#ffffff')
  return art.outline(INK)
}

// Front of a visitor seated on the bench: knees toward us, hands on the lap, shoes hanging below the seat.
export function sittingVisitorArt(id:Parameters<typeof headArt>[0],blink=false){
  const option=avatarOptions.find(a=>a.id===id)
  const skin=option?`#${option.body.toString(16).padStart(6,'0')}`:'#f3cf82'
  const body=new PixelArt(20,26)
  body.rect(5,14,10,6,'#5fa058').rect(14,15,1,5,'#4c8747').rect(7,15,6,5,'#f8f3e6').rect(7,14,1,1,'#f8f3e6').rect(12,14,1,1,'#f8f3e6')
  body.rect(5,20,10,2,'#4a7d45').rect(5,21,10,1,'#3f6c3b')
  body.rect(4,17,2,3,skin).rect(14,17,2,3,skin)
  body.rect(6,22,3,1,'#4a7d45').rect(11,22,3,1,'#4a7d45').rect(6,23,3,1,'#5a3b27').rect(11,23,3,1,'#5a3b27')
  body.outline(INK)
  return body.stamp(headArt(id,blink),0,0)
}

// A two-seat wooden bench (bangko), the kind that sits outside every sari-sari store.
export function benchArt(){
  const art=new PixelArt(34,18)
  art.rect(2,0,2,18,WOOD_DARK).rect(30,0,2,18,WOOD_DARK)
  art.rect(1,1,32,3,WOOD).rect(1,1,32,1,WOOD_LIGHT).rect(1,5,32,2,WOOD).rect(1,5,32,1,WOOD_LIGHT)
  art.rect(0,8,34,3,WOOD_LIGHT).rect(0,8,34,1,'#e0b07a').rect(0,11,34,1,WOOD_DARK)
  art.rect(3,12,2,6,WOOD_DEEP).rect(29,12,2,6,WOOD_DEEP).rect(5,15,24,1,WOOD_DARK)
  return art.outline(INK).shadow(17,17.4,16,1)
}

// A cheerful drinks machine. 'blink' lights the selection button; 'vend' shows a can in the tray.
export function vendingArt(frame:'idle'|'blink'|'vend'){
  const art=new PixelArt(22,38),body='#c8553d',shade='#a8432f'
  art.rect(0,0,22,36,body).rect(19,0,3,36,shade).rect(0,0,22,1,'#e07a5c')
  art.rect(1,1,20,6,'#fff8ea').rect(1,6,20,1,'#e6dccb')
  art.rect(2,8,13,17,'#3b3d44').rect(2,8,13,1,'#55575f')
  vendingProducts.slice(0,6).forEach((product,i)=>{
    const x=3+(i%3)*4,y=10+Math.floor(i/3)*7
    art.rect(x,y,3,5,product.can).rect(x,y+2,3,1,product.band).set(x,y,'#ffffff')
  })
  art.rect(3,23,11,1,'#55575f').rect(3,16,11,1,'#55575f')
  art.rect(16,9,3,15,shade).rect(17,10,1,3,'#2b1d16')
  for(let y=15;y<23;y+=3)art.set(17,y,frame==='blink'&&y===18?'#a9ec8f':'#ffd45e')
  art.rect(4,27,13,6,'#2b1d16').rect(4,27,13,1,'#55575f')
  if(frame==='vend')art.rect(8,30,5,3,vendingProducts[0]!.can).rect(8,31,5,1,vendingProducts[0]!.band)
  art.rect(1,36,3,2,'#55575f').rect(18,36,3,2,'#55575f')
  return art.outline(INK).shadow(11,37.6,10,1)
}

// A sidewalk chalkboard (A-frame) beside the store door; the scene writes the ready order number on it.
export function orderBoardArt(){
  const art=new PixelArt(28,26)
  art.rect(3,21,2,5,WOOD_DARK).rect(23,21,2,5,WOOD_DARK)
  art.box(0,0,28,22,'#6b4630',INK).rect(2,2,24,18,'#22392f').rect(2,2,24,1,'#2c4a3d')
  art.rect(5,8,18,1,'#e9dcc0')
  return art.shadow(14,25.4,12,1)
}

// A cast-iron street lamp. Unlit by day; the scene adds the glow around a lit head.
export function lampArt(lit:boolean){
  const art=new PixelArt(12,48),iron='#3b3d44'
  art.rect(5,9,2,36,'#4a4e55').rect(5,9,1,36,'#5f646c')
  art.rect(3,43,6,4,iron).rect(2,46,8,1,iron)
  art.rect(3,0,6,1,iron).rect(2,1,8,2,iron)
  art.rect(3,3,6,5,lit?'#fff1b8':'#d8d2c4').rect(4,4,2,2,lit?'#ffffff':'#ece8de')
  art.rect(2,8,8,1,iron)
  return art.outline(INK)
}
// Soft stepped rings of lamplight, added (not painted) over the scene.
export function glowArt(radius:number,color:string){
  const art=new PixelArt(radius*2,radius*2)
  for(const [scale,alpha] of [[1,'14'],[.72,'22'],[.46,'33']] as const)art.ellipse(radius,radius,radius*scale,radius*scale,`${color}${alpha}`)
  return art
}
export function lightPoolArt(){
  const art=new PixelArt(40,12)
  return art.ellipse(20,6,19.5,5.5,'#ffe4a018').ellipse(20,6,13,3.6,'#ffe4a026')
}

// A mango tree with a few ripe mangoes; frame 1 lifts the top of the canopy a pixel for a gentle sway.
export function treeArt(frame:0|1){
  const art=new PixelArt(36,46),top=frame?-1:0
  art.rect(15,28,6,16,WOOD_DARK).rect(15,28,2,16,WOOD).rect(13,42,10,2,WOOD_DARK)
  art.ellipse(18,16+top,15.5,12,LEAF_DARK).ellipse(11,19,9,8,LEAF).ellipse(24,13+top,10,8.5,LEAF).ellipse(17,9+top,8,6,LEAF_LIGHT)
  for(const [x,y] of [[8,22],[26,20],[16,25]] as const)art.rect(x,y,2,3,'#f6c445').set(x,y,'#e8843c')
  for(const [x,y] of [[13,6],[22,9],[6,17],[29,15]] as const)art.set(x,y+top,'#a8d686')
  return art.outline(INK).shadow(18,45,10,1.2)
}

// A wooden planter of gumamela (hibiscus).
export function planterArt(){
  const art=new PixelArt(28,14)
  art.ellipse(14,5,13,5,LEAF_DARK).ellipse(9,4,6,3.5,LEAF).ellipse(20,4,6,3.5,LEAF)
  for(const [x,y] of [[6,3],[13,1],[21,3],[17,5]] as const)art.rect(x,y,3,3,'#e0533f').set(x+1,y+1,'#ffd45e')
  art.rect(1,7,26,6,WOOD).rect(1,7,26,1,WOOD_LIGHT).rect(1,12,26,1,WOOD_DARK).rect(9,8,1,4,WOOD_DARK).rect(18,8,1,4,WOOD_DARK)
  return art.outline(INK).shadow(14,13.4,13,1)
}
export function leafArt(){return new PixelArt(4,3).rect(0,1,3,1,LEAF).set(2,0,LEAF_LIGHT).set(3,1,LEAF_DARK)}
export function canArt(){const can=vendingProducts[0]!;return new PixelArt(5,7).rect(0,0,5,7,can.can).rect(0,3,5,1,can.band).rect(0,0,5,1,'#d9d2c4').outline(INK)}
