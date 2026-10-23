import {avatarOptions} from '../shared/avatars'
import {isColdCan,isDrink,type DrinkId,type HeldDrink} from '../shared/cafe'
import {vendingProducts} from '../shared/world'
import {INK,LEAF,LEAF_DARK,LEAF_LIGHT,PixelArt,WOOD,WOOD_DARK,WOOD_DEEP,WOOD_LIGHT,headArt} from './pixelArt'

// Kape & Chits pixel art: one art pixel per texture pixel, shown at ART_SCALE like the store and the street.
// The room is 180x290 art pixels (360x580 world units), with the same walkable floor as the store.
const CREAM_WALL='#f1e2c6',PLANK=['#b98257','#ad774d','#c48b5f'],SEAM='#8e5c3c',SAGE='#7d9a6b',SAGE_DARK='#5f7f5c',AMBER='#ffd98a'
const hex=(value:number)=>`#${value.toString(16).padStart(6,'0')}`
const noise=(x:number,y:number)=>((x*73856093)^(y*19349663))>>>0
type HeadId=Parameters<typeof headArt>[0]

// The back-wall window's glass (art pixels), which the scene repaints for dusk, night and rain.
export const CAFE_WINDOW_GLASS={x:102,y:46,w:36,h:38}
// Bulbs on the string of lights under the sign (art pixels); the scene adds a soft glow over each.
const wireY=(x:number)=>37+Math.round(Math.sin(x/180*Math.PI)*4)
export const CAFE_BULBS=Array.from({length:11},(_,i)=>{const x=10+i*16;return {x,y:wireY(x)+3}})

export function cafeRoomArt(){
  const art=new PixelArt(180,290)
  art.rect(0,0,180,101,CREAM_WALL)
  for(let y=4;y<76;y+=6)for(let x=0;x<180;x++)if(noise(x,y)%9===0)art.set(x,y,'#ecdcbd')
  art.rect(0,0,180,4,WOOD_DEEP).rect(0,4,180,1,WOOD_DARK)
  // Sign board: wooden frame around muted green; the scene writes the name on it.
  art.box(34,6,112,30,WOOD,INK).rect(35,7,110,1,WOOD_LIGHT).rect(37,9,106,24,'#3f5a45').rect(37,9,106,1,'#4f6d55').rect(37,31,106,2,'#344b3a')
  for(const [x,y] of [[39,11],[140,11],[39,30],[140,30]] as const)art.set(x,y,'#c9a06c')
  // String of lights under the sign.
  for(let x=0;x<180;x++)art.set(x,wireY(x),'#5e4a3a')
  for(const bulb of CAFE_BULBS)art.set(bulb.x,bulb.y-2,'#3d2a1e').rect(bulb.x-1,bulb.y-1,2,2,AMBER).set(bulb.x-1,bulb.y-1,'#fff3d6')
  // Wainscot along the lower wall.
  art.rect(0,76,180,23,'#8a5c3a').rect(0,76,180,2,WOOD_LIGHT).rect(0,78,180,1,WOOD_DARK)
  for(let x=6;x<180;x+=12)art.rect(x,79,1,20,'#7a4f31')
  // Chalk menu (left): the scene writes KAPE MENU and ALL FREE; chalk lines stand for the drinks.
  art.box(8,46,40,30,'#22392f','#6b4630').rect(9,47,38,1,'#2c4a3d').rect(7,45,42,1,WOOD_DARK)
  for(const [y,w] of [[56,24],[61,20],[66,26],[71,18]] as const)art.rect(12,y,w,1,'#e9dcc0').rect(42,y,2,1,'#f3a09c')
  // Shelves of mugs and coffee bags.
  for(const y of [56,72]){art.rect(52,y,42,2,WOOD_LIGHT).rect(52,y+2,42,1,WOOD_DARK).set(55,y+3,WOOD_DARK).set(90,y+3,WOOD_DARK)}
  for(const [x,color] of [[54,'#fff8ea'],[60,'#c8553d'],[66,'#7cc4e8'],[72,'#fff8ea'],[78,'#e9b84f']] as const)art.box(x,50,5,6,color,INK).set(x+5,52,INK).set(x+5,53,INK)
  for(const [x,color,band] of [[54,'#7a4f31','#f6dfb4'],[62,'#5f7f5c','#fff1cf'],[70,'#a8432f','#ffd45e']] as const)art.box(x,63,7,9,color,INK).rect(x+1,67,5,2,band).rect(x+2,62,3,1,INK)
  art.box(80,64,10,8,'#d9b07a','#8a6a4a').rect(81,65,8,1,'#e8c690')
  // Hanging plant on the shelf end.
  art.stroke(92,50,96,62,1.4,LEAF,false).stroke(94,50,99,58,1.2,LEAF_DARK,false).box(89,46,8,5,'#c4744a',INK)
  // Window to the street; mullions in wood, a little plant on the sill.
  const g=CAFE_WINDOW_GLASS
  art.box(g.x-2,g.y-2,g.w+4,g.h+4,'#b9e0ef','#6b4630').rect(g.x,g.y,g.w,g.h,'#b9e0ef')
  art.rect(g.x,g.y,g.w,8,'#a9d8ea').rect(g.x,g.y+g.h-10,g.w,10,'#cfe9f2')
  art.rect(g.x+g.w/2-1,g.y,2,g.h,'#6b4630').rect(g.x,g.y+18,g.w,2,'#6b4630')
  for(const [dx,dy] of [[3,3],[4,2],[5,1],[22,5],[23,4]] as const)art.set(g.x+dx,g.y+dy,'#e8f6fb')
  art.rect(g.x-4,g.y+g.h+2,g.w+8,3,WOOD_LIGHT).rect(g.x-4,g.y+g.h+4,g.w+8,1,WOOD_DARK)
  art.box(g.x+26,g.y+g.h-3,7,5,'#c4744a',INK).ellipse(g.x+29.5,g.y+g.h-5,4,3,LEAF).set(g.x+28,g.y+g.h-7,LEAF_LIGHT)
  // Chika board: cork with pinned notes, and a plaque the scene labels.
  art.box(146,46,30,34,'#c99a63',WOOD_DARK).rect(147,47,28,1,'#d9ad78')
  for(let y=48;y<79;y++)for(let x=147;x<175;x++)if(noise(x,y)%11===0)art.set(x,y,'#b3844f')
  for(const [x,y,color] of [[149,49,'#fff8ea'],[161,50,'#f3c6c2'],[150,63,'#d8e8c4'],[163,64,'#fff1b0']] as const){
    art.rect(x,y,10,10,color).set(x+4,y,'#d9473f')
    for(let row=y+3;row<y+9;row+=2)art.rect(x+2,row,6-(row%3),1,'#9b846a')
  }
  art.box(150,81,22,9,'#6e4a31',INK).rect(151,82,20,1,'#86593b')
  art.rect(0,99,180,2,WOOD_DEEP)
  // Plank floor: staggered boards with a little grain.
  for(let y=101;y<274;y++){
    const row=Math.floor((y-101)/6),offset=(row*13)%30
    for(let x=0;x<180;x++){
      const seam=(y-101)%6===5||(x+offset)%30===0
      const n=noise(x,y)%23
      art.set(x,y,seam?SEAM:n===0?'#a26c48':n===1?'#cc966a':PLANK[row%3]!)
    }
  }
  // Lounge rug under the sofa corner.
  art.rect(114,130,62,22,'#e9dcc0').rect(116,132,58,18,SAGE).rect(116,132,58,1,'#93ad80')
  for(let x=118;x<174;x+=4)art.set(x,140,'#e9dcc0').set(x+2,141,SAGE_DARK)
  // Front wall with the doorway, as in the store.
  art.rect(0,274,180,16,'#8a5c3a').rect(0,274,180,1,'#6b4630').rect(0,275,180,1,WOOD_LIGHT).rect(0,286,180,4,'#6e4a31')
  for(let y=274;y<290;y++)for(let x=62;x<118;x++)art.set(x,y,(y-274)%6===5?SEAM:PLANK[Math.floor((y-274)/6)%3]!)
  return art
}

// The coffee counter, with a cake dome and a stack of cups on the marble top (row 12).
export function cafeCounterArt(){
  const art=new PixelArt(96,40)
  art.rect(1,12,94,5,'#efe3cf').rect(1,12,94,1,'#fffaf0').rect(1,16,94,1,'#d8c9ae')
  art.rect(1,17,94,19,'#7a4f31').rect(1,17,94,1,'#5e3d27')
  for(let x=8;x<94;x+=8)art.rect(x,18,1,18,'#6b4630')
  art.rect(1,21,94,2,SAGE_DARK).rect(1,21,94,1,SAGE)
  art.rect(1,36,94,3,WOOD_DEEP)
  // Small plant, cake under a glass dome, a stack of cups and a jar of stirrers.
  art.box(4,7,7,6,'#c4744a','#8a4f2c').ellipse(7.5,5,4,3,LEAF).set(6,3,LEAF_LIGHT).set(9,4,LEAF_DARK)
  art.rect(62,11,16,1,'#d8c9ae').ellipse(70,7,7,5,'#dfeef0').rect(63,7,14,4,'#dfeef0').rect(66,8,8,3,'#f6dfb4').rect(66,8,8,1,'#c8553d').set(70,1,'#9aa3ab').set(65,4,'#ffffff')
  for(let i=0;i<4;i++)art.rect(82,8-i*2+4,7,2,i%2?'#fff8ea':'#efe3cf').set(82,8-i*2+4,'#d8c9ae')
  art.box(90,6,4,6,'#dfeef0',INK).set(91,4,'#c8553d').set(92,3,'#5f7f5c')
  return art.outline(INK)
}

// Espresso machine on the counter. 'brew' lights the lamp green and runs a thin stream into a cup.
export function espressoArt(frame:'idle'|'brew'){
  const art=new PixelArt(24,18),steel='#9aa3ab',dark='#6f777f'
  art.rect(1,2,22,13,steel).rect(1,2,22,1,'#c5cad0').rect(20,3,2,12,dark)
  art.rect(4,0,5,2,'#fff8ea').rect(10,0,5,2,'#c8553d').rect(16,0,4,2,'#fff8ea')
  art.rect(3,4,18,3,'#3b3d44').set(5,5,frame==='brew'?'#a9ec8f':'#ad513f').set(8,5,'#ffd45e')
  for(const x of [6,15])art.rect(x,8,4,2,dark).rect(x+1,10,2,1,'#3b3d44')
  if(frame==='brew')art.rect(7,11,1,3,'#5e3d27').rect(16,11,1,3,'#5e3d27')
  art.rect(4,14,6,2,'#fff8ea').rect(14,14,6,2,'#fff8ea')
  art.rect(1,15,22,2,'#55575f').rect(2,16,20,1,'#3b3d44')
  return art.outline(INK)
}

// The barista: cream shirt, brown apron, green beanie. Frames: idle, blink, wave, brew (reaching for the machine), serve.
export type BaristaFrame='idle'|'blink'|'wave'|'brew'|'serve'
export function baristaArt(frame:BaristaFrame){
  const art=new PixelArt(24,28),skin='#fff0da',shirt='#f8f3e6',apron='#8a5c3a'
  art.rect(6,15,12,10,shirt).rect(17,16,1,9,'#e6dccb')
  art.rect(8,16,8,9,apron).set(8,15,apron).set(15,15,apron).rect(10,20,4,2,'#7a4f31').rect(9,24,6,1,'#7a4f31')
  if(frame==='wave')art.rect(4,16,2,4,shirt).rect(4,20,2,1,skin).rect(18,10,2,6,shirt).rect(18,8,2,2,skin)
  else if(frame==='brew')art.rect(1,17,5,2,shirt).rect(0,17,1,2,skin).rect(14,18,6,2,shirt).rect(13,18,1,2,skin)
  else if(frame==='serve')art.rect(4,18,5,2,shirt).rect(9,18,1,2,skin).rect(15,18,5,2,shirt).rect(14,18,1,2,skin)
  else art.rect(4,16,2,4,shirt).rect(18,16,2,4,shirt).rect(4,20,2,1,skin).rect(18,20,2,1,skin)
  art.rect(8,25,3,2,'#5a3b27').rect(13,25,3,2,'#5a3b27')
  art.outline(INK)
  return art.stamp(baristaHead(frame==='blink'),2,0)
}
// The staff head under a green beanie, folded at the brim.
function baristaHead(blink=false){
  const head=headArt('staff',blink)
  head.rect(4,0,12,1,INK).rect(3,1,14,1,'#4f7d5c').rect(2,2,16,2,'#4f7d5c').rect(2,4,16,1,'#3f6a4c').set(1,2,INK).set(1,3,INK).set(1,4,INK).set(18,2,INK).set(18,3,INK).set(18,4,INK).set(2,1,INK).set(17,1,INK)
  for(const x of [5,9,13])head.set(x,2,'#6a9a74')
  return head
}

// A round café table; variant picks what sits on it.
export function cafeTableArt(variant:0|1|2){
  const art=new PixelArt(36,22)
  art.rect(17,9,2,10,WOOD_DARK).rect(11,19,14,2,WOOD_DEEP).rect(12,19,12,1,WOOD_DARK)
  art.ellipse(18,5.5,17,5,WOOD).ellipse(18,4.8,16,4,WOOD_LIGHT).rect(2,7,32,1,'#8a5c3a')
  if(variant===0)art.box(10,1,4,4,'#fff8ea',INK).set(14,2,INK).rect(23,0,3,4,'#dfeef0').set(24,-1,'#e0533f').set(24,0,LEAF)
  else if(variant===1)art.box(9,1,4,4,'#c8553d',INK).box(22,1,4,4,'#fff8ea',INK).set(26,2,INK)
  else art.box(16,1,5,4,'#c4744a',INK).ellipse(18.5,0.5,3,2,LEAF)
  return art.outline(INK).shadow(18,21.4,12,1)
}
// A bistro chair seen from the front; a seated visitor covers most of it.
export function cafeChairArt(){
  const art=new PixelArt(16,22)
  art.rect(2,1,12,2,WOOD_DARK).rect(2,1,2,11,WOOD_DARK).rect(12,1,2,11,WOOD_DARK).rect(5,4,6,1,WOOD).rect(5,7,6,1,WOOD)
  art.rect(1,11,14,3,WOOD).rect(1,11,14,1,WOOD_LIGHT)
  art.rect(2,14,2,7,WOOD_DARK).rect(12,14,2,7,WOOD_DARK).rect(4,18,8,1,WOOD_DEEP)
  return art.outline(INK).shadow(8,21.4,7,1)
}
// A muted green two-seat sofa for the lounge corner.
export function sofaArt(){
  const art=new PixelArt(56,26),fabric=SAGE,shade=SAGE_DARK,light='#93ad80'
  art.rect(4,2,48,12,fabric).rect(4,2,48,1,light).rect(28,3,1,10,shade)
  art.rect(0,6,6,15,fabric).rect(50,6,6,15,fabric).rect(0,6,6,1,light).rect(50,6,6,1,light).rect(5,7,1,14,shade).rect(50,7,1,14,shade)
  art.rect(6,13,22,5,'#8aa776').rect(29,13,21,5,'#8aa776').rect(6,13,44,1,light).rect(28,13,1,5,shade)
  art.rect(1,18,54,4,shade).rect(1,18,54,1,'#6f8f69')
  art.box(9,6,9,7,'#f3c6c2','#c9938d').box(38,6,9,7,'#fff1b0','#d9c37a')
  art.rect(3,22,3,3,WOOD_DARK).rect(50,22,3,3,WOOD_DARK)
  return art.outline(INK).shadow(28,25.4,24,1)
}

// A cup for each drink, small enough to sit in a visitor's hand.
export function cupArt(id:DrinkId){
  const art=new PixelArt(9,12)
  if(id==='iced-coffee'){
    art.rect(5,0,1,3,'#6fa55a').set(6,0,'#6fa55a')
    art.rect(1,3,7,1,'#cfe6ea').rect(2,4,5,7,'#e8f4f6').rect(2,6,5,5,'#a26c48').set(3,6,'#ffffff').set(5,7,'#ffffff').set(4,9,'#f6dfb4')
  }else if(id==='hot-latte'){
    art.rect(1,4,6,7,'#fff8ea').rect(2,4,4,1,'#d9a877').set(3,4,'#f6dfb4').rect(7,5,1,1,'#fff8ea').rect(8,6,1,2,'#fff8ea').set(7,8,'#fff8ea').rect(1,10,6,1,'#e6dccb')
  }else if(id==='cappuccino'){
    art.rect(2,3,5,1,'#fffdf6').set(4,2,'#fffdf6').rect(2,4,5,4,'#fff8ea').set(7,5,'#fff8ea').set(8,6,'#fff8ea').rect(0,8,9,1,'#fff8ea').rect(1,9,7,1,'#e6dccb').set(3,3,'#d9a877')
  }else{
    art.rect(1,4,6,7,'#c8553d').rect(2,4,4,1,'#5e3d27').set(2,3,'#ffffff').set(4,3,'#ffe3ec').rect(7,5,1,1,'#c8553d').rect(8,6,1,2,'#c8553d').set(7,8,'#c8553d').rect(1,10,6,1,'#a8432f')
  }
  return art.outline(INK)
}

// The CR in the front wall, beside the entrance: a plaque the scene letters "CR" with a light (green free, red busy),
// over a wooden door that swings open while someone goes in or comes out.
export function restroomDoorArt(open:boolean,busy:boolean){
  const art=new PixelArt(36,16)
  art.rect(0,9,36,7,'#7b5236').rect(0,9,36,1,'#94643f')
  art.box(9,0,18,10,'#f7e3bd','#8a6446').rect(10,1,16,1,'#fff3d9')
  art.rect(22,2,2,2,busy?'#e0533f':'#7cc46a').set(22,2,busy?'#ff9d8c':'#c4f0b0')
  // Door posts either side, then the door: one wide leaf, swung back against the left post while open.
  art.rect(1,11,2,5,WOOD_DARK).rect(33,11,2,5,WOOD_DARK)
  if(open)art.rect(3,12,30,4,'#3a2a20').rect(3,12,5,4,WOOD).rect(3,12,5,1,WOOD_LIGHT)
  else art.rect(3,12,30,4,WOOD).rect(3,12,30,1,WOOD_LIGHT).rect(3,15,30,1,WOOD_DARK).rect(17,13,2,2,WOOD_DARK).set(29,14,'#e9b84f')
  return art
}

// A cold can from the street's vending machine, in its flavour's colours, small enough to hold.
export function canArt(id:string){
  const product=vendingProducts.find(entry=>entry.id===id),body=product?.can??'#c8553d',band=product?.band??'#fff1cf'
  const art=new PixelArt(7,12)
  art.rect(1,1,5,1,'#c5cad0').set(3,0,'#9aa3ab').rect(1,2,5,8,body).rect(1,5,5,2,band).rect(2,3,1,2,'#ffffff').rect(1,10,5,1,'#9aa3ab')
  return art.outline(INK)
}
// Whatever a visitor holds: a café cup or a can. Its texture is always `cup-<id>`.
export function heldDrinkArt(id:HeldDrink){return isDrink(id)?cupArt(id):canArt(id)}
// A green garbage bin with a swing lid; 'open' tips the lid up while something drops in.
export function binArt(frame:'idle'|'open'){
  const art=new PixelArt(16,20),green='#5f7f5c',dark='#4f6d55',light='#7d9a6b'
  art.rect(2,6,12,13,green).rect(2,6,1,13,light).rect(12,6,2,13,dark)
  for(const x of [5,8,11])art.rect(x,8,1,9,dark)
  art.rect(3,17,10,1,dark)
  if(frame==='open')art.rect(1,1,13,2,dark).rect(2,0,11,1,light).set(1,3,dark).set(2,4,dark).rect(6,2,4,1,'#3a2a20')
  else art.rect(1,3,14,3,dark).rect(2,3,12,1,light).rect(6,2,4,1,dark)
  return art.outline(INK).shadow(8,19.4,7,1)
}

// A visitor waving: the store's standing body (or the street's seated one) with the right arm raised.
export function wavingVisitorArt(id:HeadId,seated:boolean){
  const option=avatarOptions.find(a=>a.id===id)
  const skin=option?hex(option.body):'#f3cf82'
  const body=new PixelArt(20,26)
  if(seated){
    body.rect(5,14,10,6,'#5fa058').rect(14,15,1,5,'#4c8747').rect(7,15,6,5,'#f8f3e6').rect(7,14,1,1,'#f8f3e6').rect(12,14,1,1,'#f8f3e6')
    body.rect(5,20,10,2,'#4a7d45').rect(5,21,10,1,'#3f6c3b').rect(4,17,2,3,skin).rect(15,10,2,5,skin)
    body.rect(6,22,3,1,'#4a7d45').rect(11,22,3,1,'#4a7d45').rect(6,23,3,1,'#5a3b27').rect(11,23,3,1,'#5a3b27')
  }else{
    body.rect(5,14,10,7,'#5fa058').rect(14,15,1,6,'#4c8747').rect(7,15,6,6,'#f8f3e6').rect(7,14,1,1,'#f8f3e6').rect(12,14,1,1,'#f8f3e6').rect(8,19,4,1,'#e6dccb')
    body.rect(3,16,2,3,skin).rect(15,10,2,5,skin)
    body.rect(6,21,3,2,'#4a7d45').rect(6,23,3,1,'#5a3b27').rect(11,21,3,2,'#4a7d45').rect(11,23,3,1,'#5a3b27')
  }
  body.outline(INK)
  body.stamp(headArt(id),0,0)
  return seated?body:body.shadow(10,25,7,1.2)
}

// Café sprites for the page's dialogs (see PixelSprite): the barista's face, the cups and the cans.
export function cafeSpriteArt(name:string):PixelArt|undefined{
  if(name==='head-barista')return baristaHead()
  if(name.startsWith('cup-')){const id=name.slice(4);if(isDrink(id)||isColdCan(id))return heldDrinkArt(id)}
}
