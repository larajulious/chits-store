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
// Kape & Chits, the 24/7 café that took over the old Hugot Burger spot: cream walls under a green-striped
// awning, a sign board the scene letters, warm windows (an OPEN 24/7 sign hangs in the left one) and a
// door frame for the glass doors the scene draws. CAFE_FRONT_WINDOWS are the panes it lights at night.
export const CAFE_FRONT_WINDOWS=[{x:271,y:96},{x:329,y:96}]
function cafeFront(art:PixelArt,x:number){
  art.rect(x-2,40,100,6,WOOD_DEEP).rect(x-2,40,100,1,WOOD_DARK).rect(x-2,45,100,1,INK)
  art.rect(x,46,96,80,'#f1e2c6').rect(x,46,96,2,'#e2cfae').rect(x+94,46,2,80,'#e2cfae')
  for(let y=50;y<124;y+=6)for(let i=x;i<x+94;i++)if(((i*7+y*3)>>>0)%13===0)art.set(i,y,'#e8d6b6')
  art.box(x+8,49,80,18,'#3f5a45',INK).rect(x+9,50,78,1,'#4f6d55').rect(x+9,64,78,2,'#344b3a')
  for(const [dx,dy] of [[10,51],[85,51],[10,63],[85,63]] as const)art.set(x+dx,dy,'#c9a06c')
  for(let i=0;i<10;i++){
    const sx=x-2+i*10,color=i%2?'#5f7f5c':'#f6ead2'
    art.rect(sx,68,10,6,color).rect(sx+1,74,8,1,color).rect(sx+2,75,6,1,color).rect(sx,68,10,1,i%2?'#7d9a6b':'#fffaf0')
    art.set(sx,74,'#3f5a45').set(sx+1,75,'#3f5a45').rect(sx+2,76,6,1,'#3f5a45').set(sx+8,75,'#3f5a45').set(sx+9,74,'#3f5a45')
  }
  // Warm windows: string lights, a table with a mug, and a plant inside.
  for(const wx of [x+4,x+62]){
    art.box(wx,80,30,32,'#ffe3a3','#6b4630').rect(wx+1,81,28,1,'#fff1cf')
    for(let i=wx+2;i<wx+28;i+=4)art.set(i,84+((i-wx)%8?1:0),'#ffb347')
    art.rect(wx+5,103,12,2,WOOD).rect(wx+10,105,2,6,WOOD_DARK).rect(wx+7,100,3,3,'#fff8ea').set(wx+10,101,'#fff8ea')
    art.rect(wx+22,104,5,7,'#c4744a').ellipse(wx+24.5,101,4,3.5,LEAF).set(wx+23,99,LEAF_LIGHT)
    art.rect(wx-2,112,34,3,WOOD_LIGHT).rect(wx-2,114,34,1,WOOD)
  }
  // The OPEN 24/7 sign's dark backing in the left window.
  art.box(x+9,86,20,13,'#2b2430','#4b3a5a')
  // Door frame and the warm room behind the glass doors.
  art.rect(x+36,78,24,48,'#3f5a45').rect(x+37,79,22,1,'#4f6d55').rect(x+38,80,20,46,'#ffd98a')
  art.rect(x+34,124,28,2,'#cfa97c').rect(x+34,124,28,1,'#e2c49c')
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
  cafeFront(art,252)
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
// Big potted plants mark where the walkable pavements end; the road runs on (see vehicleArt).
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

// The café's glass doors: dark-green frames around warm glass. Frames 0..3 slide them apart like the store's.
export function cafeDoorArt(frame:0|1|2|3){
  const art=new PixelArt(20,46),offset=[0,3,6,10][frame]!
  art.rect(0,0,20,46,'#ffd98a').rect(0,30,20,16,'#c48b5f').rect(0,36,20,1,'#ad774d')
  const leaf=(x:number,handle:number)=>{
    art.rect(x,0,10,46,'#3f5a45').rect(x,0,10,1,'#4f6d55').rect(x,45,10,1,'#2b3d30')
    art.rect(x+1,2,8,41,'#f6e3b8').rect(x+1,2,8,1,'#fff6dc').rect(x+2,4,1,6,'#fffaf0').rect(x+3,4,1,3,'#fffaf0')
    art.rect(x+handle,20,1,5,'#e9b84f')
  }
  leaf(-offset,8);leaf(10+offset,1)
  return art
}
// A sidewalk chalkboard for the café: a steaming cup above a line the scene writes on.
export function cafeSignArt(){
  const art=new PixelArt(24,30)
  art.rect(3,25,2,5,WOOD_DARK).rect(19,25,2,5,WOOD_DARK)
  art.box(0,0,24,26,'#6b4630',INK).rect(2,2,20,22,'#22392f').rect(2,2,20,1,'#2c4a3d')
  art.rect(7,8,9,7,'#fff8ea').rect(16,9,2,1,'#fff8ea').rect(17,10,1,3,'#fff8ea').rect(16,13,1,1,'#fff8ea').rect(8,8,7,1,'#c88b4d').rect(6,15,12,1,'#e9dcc0')
  art.set(9,6,'#e9dcc0').set(10,5,'#e9dcc0').set(12,6,'#e9dcc0').set(13,5,'#e9dcc0')
  return art.shadow(12,29.4,11,1)
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

// A mango tree: a dome of leaf clusters lit from the top left, a flared trunk with branches showing
// between the clusters, and ripe mangoes hanging under the canopy. Frame 1 leans the crown a pixel for a sway.
const LEAF_DEEP='#356b31',LEAF_SHINE='#a8d686',BARK_SHADE='#5e3d27'
function leafCluster(art:PixelArt,cx:number,cy:number,rx:number,ry:number){
  art.ellipse(cx,cy,rx,ry,LEAF_DARK).ellipse(cx-.7,cy-.9,rx-1.2,ry-1.2,LEAF)
  art.ellipse(cx-rx*.32,cy-ry*.42,rx*.5,ry*.42,LEAF_LIGHT)
}
export function treeArt(frame:0|1){
  const art=new PixelArt(44,50),sway=frame?1:0
  // Trunk and roots first, then two branches reaching up into the crown.
  art.rect(19,30,6,16,WOOD_DARK).rect(19,30,2,16,WOOD).rect(24,30,1,16,BARK_SHADE)
  art.rect(18,43,8,2,WOOD_DARK).rect(17,45,10,1,WOOD_DARK).rect(18,43,2,2,WOOD).set(16,45,WOOD_DARK).set(27,45,BARK_SHADE).rect(25,43,1,3,BARK_SHADE)
  art.set(21,36,BARK_SHADE).set(22,37,BARK_SHADE).set(20,41,BARK_SHADE)
  art.stroke(21,32,12,23,1.3,WOOD_DARK,false).stroke(23,31,32,22,1.3,WOOD_DARK,false).stroke(22,31,22,22,1.1,WOOD_DARK,false)
  // The crown's shaded underside, then clusters from the back to the front.
  art.ellipse(22,24,19,8,LEAF_DEEP)
  for(const [cx,cy,rx,ry,top] of [[22,11,10,8,1],[13,14,8,7,1],[31,14,8,7,1],[8,22,7,6,0],[36,22,7,6,0],[17,21,9,7,0],[28,22,9,7,0],[22,27,8,4.5,0]] as const)
    leafCluster(art,cx+(top?sway:0),cy,rx,ry)
  // Leaf texture: little dark notches on the green, a few bright leaves on the lit tops.
  for(let y=0;y<34;y++)for(let x=0;x<44;x++){
    const color=art.get(x,y),n=noise(x,y)%17
    if(color===LEAF&&n===0)art.set(x,y,LEAF_DARK)
    else if(color===LEAF_LIGHT&&n<2)art.set(x,y,LEAF_SHINE)
    else if(color===LEAF_DARK&&n===3)art.set(x,y,LEAF_DEEP)
  }
  // Ripe mangoes on short stems: green near the stem, yellow, blushing orange underneath.
  for(const [x,y] of [[10,27],[31,28],[25,30],[16,28]] as const){
    art.set(x,y-1,BARK_SHADE).rect(x,y,2,3,'#f6c445').set(x,y,'#b9cf5a').set(x+1,y+2,'#e8843c').set(x+1,y+1,'#f8d36a')
  }
  return art.outline(INK).shadow(22,47.4,14,1.3)
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

// Traffic on the road, seen from the side and facing right (the scene flips it for the other lane), sized against the
// visitors (26 art pixels tall): a car a little taller than a visitor and over twice as long, a longer jeepney with its
// stripes, chrome grille and hood ornament, and a tricycle with its sidecar and a driver. Frames 0 and 1 turn the wheels.
export type Vehicle='car'|'jeepney'|'tricycle'
const CAR_PAINTS=[['#c8553d','#e07a5c','#a8432f'],['#4f8a83','#6ea8a0','#3c6e68'],['#f6c445','#fbe39a','#d9a12e'],['#7cc4e8','#b9e0ef','#5a9fc4']] as const
const STRIPES=[['#c8553d','#f6c445','#4f8a83'],['#8b5cc4','#ffd45e','#c8553d'],['#4f8a83','#f3a09c','#5a9fc4'],['#d9473f','#79945b','#f6c445']] as const
const GLASS='#b9e0ef',GLASS_SHINE='#e8f6fb',TYRE='#2b2430',HUB='#9aa3ab',CHROME='#c5cad0',HEADLIGHT='#fff3c4',TAILLIGHT='#e0533f',CABIN='#3b3d44'
function wheel(art:PixelArt,cx:number,cy:number,r:number,frame:0|1){
  art.ellipse(cx,cy,r+1.2,r+1.2,'#1e1a22').ellipse(cx,cy,r,r,TYRE).ellipse(cx,cy,r*.5,r*.5,HUB).set(Math.floor(cx),Math.floor(cy),'#5f666e')
  // Two spokes that swap between frames, so the wheel turns.
  const s=Math.floor(r*.5)
  if(frame)art.set(Math.floor(cx)-s,Math.floor(cy)-s,TYRE).set(Math.floor(cx)+s,Math.floor(cy)+s,TYRE)
  else art.set(Math.floor(cx)+s,Math.floor(cy)-s,TYRE).set(Math.floor(cx)-s,Math.floor(cy)+s,TYRE)
}
export function vehicleArt(kind:Vehicle,paint:number,frame:0|1){
  if(kind==='jeepney')return jeepneyArt(paint,frame)
  if(kind==='tricycle'){
    const art=new PixelArt(54,34),[body,light,dark]=CAR_PAINTS[paint%CAR_PAINTS.length]!
    // The covered sidecar: a roof, its body with a dark window, and a little light at the back.
    art.rect(1,3,32,3,dark).rect(2,2,30,1,light).rect(3,6,28,19,body).rect(3,6,28,1,light).rect(3,24,28,1,dark)
    art.rect(7,9,19,9,CABIN).rect(7,9,19,1,'#5a5c64').rect(27,9,3,9,GLASS).set(4,20,TAILLIGHT).set(4,21,TAILLIGHT)
    // The motorcycle: frame, seat, tank, handlebars and headlight.
    art.rect(30,21,18,5,'#3b3d44').rect(31,19,11,2,'#5e3d27').rect(41,18,6,3,body).rect(41,18,6,1,light)
    art.rect(47,9,2,13,HUB).rect(45,9,6,1,HUB).rect(49,15,3,3,HEADLIGHT).set(51,15,'#ffffff')
    // The driver, about a visitor's size: helmet, white shirt, arms to the handlebars, legs on the pegs.
    art.ellipse(38,6,4.5,4.5,'#4f8a83').rect(34,6,9,2,'#3f6a4c').rect(40,6,3,3,'#f3cf82').set(41,7,'#2b1d16')
    art.rect(35,10,7,9,'#f8f3e6').rect(41,10,1,9,'#e6dccb').rect(41,12,6,2,'#f3cf82').rect(36,19,8,2,'#4a5f7a').rect(42,21,2,4,'#4a5f7a').rect(42,25,3,1,'#5a3b27')
    wheel(art,15,28,5,frame);wheel(art,45,28,5,frame)
    return art.outline(INK).shadow(27,33.4,25,1)
  }
  const art=new PixelArt(64,32),[body,light,dark]=CAR_PAINTS[paint%CAR_PAINTS.length]!
  // The cabin narrows to the roof: the rear pillar leans back, the windshield forward; two side windows.
  for(let y=4;y<15;y++){
    const left=Math.round(18-(y-4)*.45),right=Math.round(42+(y-4)*.6)
    art.rect(left,y,right-left,1,y===4?light:body)
  }
  for(let y=6;y<14;y++){
    const left=Math.round(19-(y-6)*.4),right=Math.round(43+(y-6)*.5)
    art.rect(left,y,30-left,1,GLASS).rect(33,y,right-33,1,GLASS)
  }
  art.set(21,7,GLASS_SHINE).set(22,8,GLASS_SHINE).set(36,7,GLASS_SHINE).set(37,8,GLASS_SHINE)
  // Hood, trunk and the long lower body with door lines, handles and sills.
  art.rect(46,12,15,3,body).rect(46,12,15,1,light).rect(4,13,12,2,body).rect(4,13,12,1,light)
  art.rect(2,15,60,10,body).rect(2,15,60,1,light).rect(2,24,60,1,dark).rect(30,15,1,9,dark).rect(46,15,1,9,dark)
  art.rect(24,18,3,1,dark).rect(40,18,3,1,dark).rect(2,25,60,1,'#5f666e')
  // Lights and bumpers.
  art.rect(59,15,3,2,HEADLIGHT).rect(2,15,2,3,TAILLIGHT).rect(61,19,3,4,CHROME).rect(0,19,3,4,CHROME)
  wheel(art,15,26,5,frame);wheel(art,49,26,5,frame)
  return art.outline(INK).shadow(32,31.4,30,1)
}

// The jeepney, as it should look: a cream canopy with a route board, a painted passenger body with open windows (some
// with riders' heads in them), a wave and a stripe of side art over a chrome strip, the open rear door with its grab
// bar and step, then a long low hood with the windshield, side mirror, silver horse, chrome grille, round headlights
// and bumper, and fenders over both wheels.
const JEEP_PAINTS=[['#c8553d','#e07a5c','#a8432f'],['#3f7aa0','#5a9fc4','#2f5f80'],['#8b5cc4','#a98ad8','#643a9c'],['#4f8a5a','#6fa87a','#3a6a44']] as const
const RIDER_HEADS=['#ffeed3','#f4d17c','#b38b6f','#f4a8b1','#c88b4d','#89a665','#b28ac5']
function jeepneyArt(paint:number,frame:0|1){
  const art=new PixelArt(98,40),[base,baseLight,baseDark]=JEEP_PAINTS[paint%JEEP_PAINTS.length]!,chromeDark='#9aa3ab'
  // Fenders first, so the body and wheels sit over them.
  art.ellipse(22,31,9,6,baseDark).ellipse(80,31,9,6,baseDark)
  // Canopy and route board.
  art.rect(5,3,64,1,'#fffaf0').rect(4,4,66,2,'#fff1cf').rect(4,6,66,1,'#e6d6b0')
  art.rect(46,0,22,4,'#fffdf6').rect(46,0,22,1,'#ffffff')
  for(let x=48;x<66;x+=3)art.rect(x,1,2,2,'#c8553d')
  // Passenger body, open windows and riders.
  art.rect(5,7,64,22,base).rect(5,7,64,1,baseLight).rect(5,28,64,1,baseDark)
  for(let i=0;i<7;i++){
    const x=9+i*8
    art.rect(x,9,6,7,CABIN).rect(x,9,6,1,'#5a5c64')
    if((paint+i)%3!==1){const head=RIDER_HEADS[(i*3+paint)%RIDER_HEADS.length]!;art.ellipse(x+3,13,2.6,2.6,head).set(x+2,12,'#2b1d16').set(x+4,12,'#2b1d16')}
  }
  // Side art: a white wave, a yellow stripe with dots, and the chrome strip.
  for(let x=6;x<68;x++){const y=19+Math.round(Math.sin(x/4)*1.4);art.set(x,y,'#fffaf0').set(x,y+1,'#fffaf0')}
  art.rect(5,23,64,2,'#ffd45e')
  for(let x=9;x<67;x+=6)art.set(x,25,'#ffd45e').set(x+1,25,'#fff1b0')
  art.rect(5,26,64,1,CHROME)
  // The open rear door, grab bar and step.
  art.rect(0,8,6,20,CABIN).rect(0,8,1,20,baseDark).rect(3,9,1,17,CHROME).rect(0,28,8,2,chromeDark).set(1,20,TAILLIGHT).set(1,21,TAILLIGHT)
  // Windshield and mirror, the long low hood, the silver horse.
  art.rect(69,7,5,11,GLASS).rect(69,7,5,1,base).set(70,9,GLASS_SHINE).set(71,10,GLASS_SHINE)
  art.rect(72,9,1,2,chromeDark).rect(73,8,2,3,CHROME)
  art.rect(69,17,22,12,base).rect(69,17,22,1,baseLight).rect(69,28,22,1,baseDark).rect(71,22,18,1,CHROME)
  for(const [x,y] of [[83,15],[84,14],[85,14],[86,13],[85,15],[84,16],[86,16]] as const)art.set(x,y,CHROME)
  art.set(87,12,'#e6e9ec').set(84,13,'#e6e9ec')
  // Chrome grille, headlights and bumper.
  art.rect(91,16,5,14,CHROME)
  for(let y=18;y<29;y+=2)art.rect(92,y,3,1,'#7f8890')
  art.ellipse(89,20,1.8,1.8,HEADLIGHT).ellipse(89,26,1.4,1.4,'#ffb347')
  art.rect(86,30,12,2,CHROME).rect(86,31,12,1,chromeDark)
  // A mud flap behind each wheel.
  art.rect(31,29,2,5,'#2b2430').rect(89,29,2,4,'#2b2430')
  wheel(art,22,33,5.5,frame);wheel(art,80,33,5.5,frame)
  return art.outline(INK).shadow(49,39.4,46,1)
}
// The jeepney stop's sign: a post with a green plate the scene letters.
export function jeepneyStopArt(){
  const art=new PixelArt(26,34)
  art.rect(12,10,2,23,'#7f8890').rect(12,10,1,23,'#c5cad0')
  art.box(0,0,26,12,'#3f6a4c','#2b3d30').rect(1,1,24,1,'#4f8a5a')
  return art.outline(INK).shadow(13,33.4,6,1)
}
