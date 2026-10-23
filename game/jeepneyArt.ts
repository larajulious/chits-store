import {INK,LEAF,LEAF_DARK,LEAF_LIGHT,PixelArt,WOOD,WOOD_DARK} from './pixelArt'

// Riding a jeepney: the jeepney seen big from the side, rolling along a country road, with its riders in the open
// windows. The jeepney is 180x84 art pixels (360x168 world units, a phone's width): drawn as the cab behind the
// riders (interiorArt), the body in front of them with the window openings left clear (bodyArt), and two wheels.
// The scenery layers are 256-pixel tiles drawn against their bottom edge; the scene lays copies side by side.
const noise=(x:number,y:number)=>((x*73856093)^(y*19349663))>>>0
const CHROME='#d5d9de',CHROME_SHADE='#9aa3ab',IVORY='#f6ead2',IVORY_SHADE='#e2cfae',RED='#c8553d',RED_DARK='#a8432f'
const YELLOW='#f6c445',TEAL='#3f8a83',CABIN='#2b2c33',GLASS='#9fd0e6',GLASS_SHINE='#e8f6fb'
export const JEEP={width:180,height:84,windows:6,windowW:20,windowGap:22,firstWindow:12,windowTop:13,windowBottom:35,wheels:[34,156],wheelY:72,wheelR:11}
// Window i's opening runs art x windowX(i) .. +windowW-1; a rider sits at its middle.
export const windowX=(i:number)=>JEEP.firstWindow+JEEP.windowGap*i
const inWindow=(x:number)=>Array.from({length:JEEP.windows},(_,i)=>windowX(i)).some(a=>x>=a&&x<a+JEEP.windowW)

// Behind the riders: the ceiling and the far bench's back in each window, sky and scenery showing in between.
// After dark the ceiling glows with the cab's warm light.
export function interiorArt(night:boolean){
  const art=new PixelArt(JEEP.width,JEEP.height)
  for(let i=0;i<JEEP.windows;i++){
    const x=windowX(i)
    art.rect(x,JEEP.windowTop,JEEP.windowW,3,night?'#6b4630':'#3b3d44').rect(x,JEEP.windowTop+3,JEEP.windowW,1,night?'#ffd98a':'#5a5c64')
    art.rect(x,27,JEEP.windowW,JEEP.windowBottom-27+1,'#9c362e').rect(x,27,JEEP.windowW,1,RED)
  }
  return art
}

// The body: roof rack and route board, painted sides with stripes and a name plate, chrome, the open rear door, the
// driver's cab with the driver, the long hood with its silver horses and flags, grille, lights, bumper, mud flaps,
// and arches for the wheels (drawn separately so they can turn). night lights the roof's marker lamps.
export function bodyArt(night:boolean){
  const {width:W,height:H}=JEEP,art=new PixelArt(W,H)
  // Roof rack and roof, with marker lamps along its edge and the route board up front (the scene letters it).
  art.rect(8,3,134,1,CHROME)
  for(let x=10;x<142;x+=12)art.rect(x,3,1,3,CHROME_SHADE)
  art.rect(6,6,138,5,'#fff1cf').rect(6,6,138,1,'#fffaf0').rect(6,10,138,1,RED)
  for(let x=10;x<142;x+=8)art.set(x,8,night?['#ff8a7a','#ffd45e','#a9ec8f','#7cc4e8'][(x/8|0)%4]!:'#e6d6b0')
  art.box(98,0,42,7,'#fffdf6',RED)
  art.rect(6,11,138,2,CHROME)
  // Window pillars (the openings stay clear), then the painted lower body.
  for(let x=6;x<144;x++)for(let y=13;y<36;y++)if(!inWindow(x))art.set(x,y,(x-JEEP.firstWindow+2)%JEEP.windowGap<2?CHROME_SHADE:IVORY)
  art.rect(6,36,138,30,IVORY).rect(6,36,138,1,'#fffaf0').rect(143,13,1,53,IVORY_SHADE)
  // Side art: a red wave band, a yellow pinstripe, a teal band with stars, the chrome rub strip and the skirt.
  const stripes=(from:number,to:number)=>{
    for(let x=from;x<to;x++){const y=39+Math.round(Math.sin(x/7)*1.5);art.rect(x,y,1,3,RED).set(x,y+3,RED_DARK)}
    art.rect(from,46,to-from,1,YELLOW).rect(from,50,to-from,5,TEAL).rect(from,50,to-from,1,'#5aa8a0')
    art.rect(from,58,to-from,2,CHROME).rect(from,60,to-from,6,IVORY_SHADE).rect(from,65,to-from,1,CHROME_SHADE)
  }
  stripes(6,144)
  for(let x=12;x<144;x+=11)art.set(x,52,'#fffaf0').set(x-1,52,'#fff1b0').set(x+1,52,'#fff1b0').set(x,51,'#fff1b0').set(x,53,'#fff1b0')
  // The name plate the scene letters.
  art.box(48,38,58,9,'#fffdf6',RED_DARK)
  // The open rear door with its grab bar, tail lights and step.
  art.rect(0,13,6,52,CABIN).rect(0,13,1,52,'#1e1f24').rect(3,15,1,46,CHROME).rect(0,64,12,3,CHROME).rect(0,66,12,1,CHROME_SHADE)
  art.rect(1,40,2,5,'#e0533f').set(1,40,'#ff9d8c')
  // The cab: the driver at his window (cap, face, white shirt, arm to the wheel), the slanted windshield, a mirror.
  art.rect(144,13,14,23,CABIN).rect(144,13,14,1,'#3b3d44')
  art.ellipse(151,22,4,4.5,'#f3cf82').rect(147,16,9,3,'#4f8a83').rect(152,18,5,1,'#3f6a4c').set(153,22,'#2b1d16').rect(147,26,9,9,'#f8f3e6').rect(154,28,4,2,'#f3cf82')
  for(let y=13;y<36;y++){const x=158+Math.floor((36-y)/5);art.rect(158,y,x-158,1,IVORY).rect(x,y,3,1,GLASS)}
  art.set(161,18,GLASS_SHINE).set(162,16,GLASS_SHINE).rect(156,17,2,4,CHROME).set(155,19,CHROME_SHADE)
  // The long hood, lower than the roof, with the stripes carried on, two silver horses and a little mast of flags.
  art.rect(144,36,33,30,IVORY).rect(158,30,19,6,IVORY).rect(158,30,19,1,'#fffaf0').rect(176,32,1,34,IVORY_SHADE)
  stripes(144,177)
  for(const [x,y] of [[164,28],[165,27],[166,27],[167,26],[166,29],[165,29],[168,28],[170,28],[171,27],[172,27],[173,26],[172,29],[171,29]] as const)art.set(x,y,CHROME)
  art.set(167,25,'#ffffff').set(173,25,'#ffffff')
  art.rect(175,14,1,16,CHROME_SHADE)
  for(const [y,color] of [[14,RED],[17,YELLOW],[20,TEAL],[23,'#7cc4e8']] as const)art.rect(176,y,3,2,color)
  // Grille, headlights, bumper.
  art.rect(177,32,3,34,CHROME)
  for(let y=34;y<64;y+=3)art.rect(178,y,2,1,'#7f8890')
  art.ellipse(175,41,2.2,2.2,'#fff3c4').set(174,40,'#ffffff').ellipse(175,48,1.6,1.6,'#ffb347')
  art.rect(160,65,20,3,CHROME).rect(160,67,20,1,CHROME_SHADE)
  // Wheel arches (the wheels go in them), running board, and mud flaps behind each wheel.
  art.rect(48,66,96,2,CHROME)
  for(const cx of JEEP.wheels){
    for(let y=55;y<H;y++)for(let x=cx-14;x<=cx+14;x++)if(((x+.5-cx)/13.5)**2+((y+.5-JEEP.wheelY)/13.5)**2<=1)art.set(x,y,null)
    for(let a=Math.PI;a<=Math.PI*2;a+=.04)art.set(Math.round(cx+Math.cos(a)*13.5),Math.round(JEEP.wheelY+Math.sin(a)*13.5),'#3b3d44')
  }
  art.rect(48,66,3,12,'#2b2430').set(49,74,'#e0533f').rect(170,66,3,11,'#2b2430')
  return art.outline(INK)
}
// A wheel: tyre, chrome rim and hub cap; frames 0..3 turn its spokes.
export function wheelArt(frame:0|1|2|3){
  const art=new PixelArt(24,24),r=JEEP.wheelR
  art.ellipse(12,12,r,r,'#2b2430').ellipse(12,12,r-3,r-3,CHROME_SHADE).ellipse(12,12,r-4,r-4,CHROME).ellipse(12,12,2.5,2.5,'#7f8890')
  const angle=frame*Math.PI/8
  for(let k=0;k<4;k++){const a=angle+k*Math.PI/2;for(let d=3;d<r-3;d++)art.set(Math.round(12+Math.cos(a)*d),Math.round(12+Math.sin(a)*d),'#7f8890')}
  return art.outline(INK)
}

const onTile=(pixels:PixelArt,height=64)=>new PixelArt(256,height).stamp(pixels,0,height-pixels.height)
// Far mountains (greys, painted in the sky's colours), tiling seamlessly.
export function rideRidgeArt(){
  const art=new PixelArt(256,50)
  for(let x=0;x<256;x++){
    const a=x/256*Math.PI*2,height=18+8*Math.sin(a*2+.4)+5*Math.sin(a*5+1)+3*Math.sin(a*11)
    const top=50-Math.round(height)
    for(let y=top;y<50;y++)art.set(x,y,y===top?'#ffffff':noise(x,y)%9===0?'#d8d8d8':'#ececec')
  }
  return onTile(art)
}
// The middle distance: rice paddies divided by dikes, the sky in their water, then a stretch of coast with the sea,
// an island and a bangka.
export function rideFieldsArt(){
  const art=new PixelArt(256,40),seaTop=8
  for(let x=0;x<256;x++){
    const coast=x>=136&&x<244,shore=26+Math.round(Math.sin(x/9)*1.5)
    for(let y=seaTop;y<40;y++){
      if(coast)art.set(x,y,y<shore?(noise(x,y)%13===0?'#cfe9f2':y===seaTop?'#7cc4e8':y<seaTop+6?'#5aa8d0':'#4f9ac4'):y<shore+3?'#f1e2b0':'#8fbf6a')
      else{
        const row=Math.floor((y-seaTop)/5),dike=(y-seaTop)%5===4,edge=(x+row*7)%32===0
        art.set(x,y,dike||edge?'#6f9a52':(row+Math.floor(x/32))%3===0?(noise(x,y)%7===0?'#cfe9f2':'#a9d8ea'):noise(x,y)%11===0?'#a8d686':'#8fbf6a')
      }
    }
  }
  art.ellipse(176,seaTop+1,14,4,'#5c8a5a').rect(162,seaTop+1,28,2,'#4f7d4a')
  art.rect(212,18,12,2,'#fff8ea').rect(214,20,8,1,RED).rect(209,19,18,1,WOOD_DARK).rect(217,13,1,5,WOOD_DARK).rect(218,13,4,4,'#fff1cf')
  for(let x=4;x<136;x+=13)art.ellipse(x,seaTop+2,4,2.6,'#5c9a4a').set(x-1,seaTop,'#7cb662')
  return onTile(art)
}
// Close to the road, passing quickly: coconut palms, a nipa hut, an electric post with its wires, a carabao grazing,
// bougainvillea, on a strip of grass.
export function rideRoadsideArt(){
  const art=new PixelArt(256,56)
  art.rect(0,48,256,8,'#5c9a4a').rect(0,48,256,1,LEAF_LIGHT)
  for(let x=0;x<256;x+=3)art.set(x,47,LEAF_DARK)
  art.rect(0,11,256,1,'#3b3d44').rect(0,15,256,1,'#3b3d44')
  const palm=(x:number,lean:number,top:number)=>{
    for(let y=top;y<49;y++)art.rect(x+Math.round((48-y)*lean/40),y,2,1,(y%4===0)?'#8a6446':'#a07850')
    const cx=x+lean,cy=top
    for(const [dx,dy,len] of [[-1,0,12],[1,0,12],[-1,1,9],[1,1,9],[0,-1,6],[-1,-.5,8],[1,-.5,8]] as const)
      for(let i=0;i<len;i++){const px=cx+Math.round(dx*i),py=cy+Math.round(dy*i*.6+(dx?i*i/20:0));art.set(px,py,i%3===0?LEAF_LIGHT:LEAF).set(px,py+1,LEAF_DARK)}
    art.rect(cx-1,cy+1,3,2,WOOD_DARK).set(cx-2,cy+2,'#79945b').set(cx+2,cy+2,'#79945b')
  }
  palm(14,4,6);palm(118,-3,9);palm(232,3,5)
  // Nipa hut on stilts.
  art.rect(48,38,2,10,WOOD_DARK).rect(76,38,2,10,WOOD_DARK).rect(46,27,34,11,'#d9b07a').rect(46,27,34,1,'#e8c690')
  for(let x=48;x<80;x+=3)art.rect(x,28,1,10,'#c99a63')
  art.rect(54,30,7,6,'#5e3d27').rect(68,31,6,7,WOOD)
  for(let i=0;i<9;i++)art.rect(44+i,26-i,38-i*2,1,i%2?'#b08a50':'#c8a060')
  // Electric post.
  art.rect(160,4,3,45,'#8a6446').rect(156,9,11,2,'#6b4630').set(157,8,CHROME_SHADE).set(165,8,CHROME_SHADE)
  // A carabao grazing by the road.
  art.ellipse(196,40,9,5,'#4a4a52').rect(188,42,3,6,'#3b3b42').rect(201,42,3,6,'#3b3b42').ellipse(186,42,3.5,3,'#4a4a52')
  art.rect(181,38,5,1,'#e6dccb').rect(184,37,1,2,'#e6dccb').rect(187,37,1,2,'#e6dccb').set(185,43,'#2b2430').rect(205,37,1,5,'#3b3b42')
  for(const [x,color] of [[130,'#e0507a'],[140,'#f08ab0'],[214,'#e0507a'],[250,YELLOW]] as const){art.ellipse(x,45,5,3.5,LEAF_DARK);for(let i=0;i<5;i++)art.set(x-3+i*2-(i%2),43+(i%2),color)}
  return onTile(art)
}
// The road: gravel shoulder, the far lane, a dashed centre line, the near lane, and white edge lines.
export function rideRoadArt(){
  const art=new PixelArt(256,60).rect(0,0,256,60,'#6a6370')
  for(let y=0;y<60;y++)for(let x=0;x<256;x++)if(noise(x,y)%29===0)art.set(x,y,'#5d5763')
  art.rect(0,0,256,3,'#c9b48f').rect(0,3,256,1,'#a99a7a').rect(0,6,256,1,'#e6e2da')
  for(let x=6;x<256;x+=32)art.rect(x,24,16,2,'#fff1cf')
  return onTile(art.rect(0,55,256,1,'#e6e2da').rect(0,58,256,2,'#565061'),60)
}
// The near verge, rushing past in front: a low bamboo fence, grass, bushes and wildflowers.
export function rideVergeArt(){
  const art=new PixelArt(256,50).rect(0,6,256,44,'#5c9a4a').rect(0,6,256,1,LEAF_LIGHT)
  for(let x=0;x<256;x++)for(let y=7;y<50;y++){const n=noise(x,y)%23;if(n===0)art.set(x,y,LEAF_LIGHT);else if(n===1)art.set(x,y,LEAF_DARK)}
  for(let x=0;x<256;x+=20)art.rect(x,0,2,12,'#c8a060').rect(x,0,2,1,'#e8c690')
  art.rect(0,3,256,1,'#b08a50').rect(0,8,256,1,'#b08a50')
  for(let x=8;x<256;x+=37)art.ellipse(x,18,8,5,LEAF_DARK).ellipse(x-1,16,6,3.5,LEAF).set(x-3,14,LEAF_LIGHT)
  for(let i=0;i<40;i++){const x=(i*61)%256,y=22+(i*17)%26;art.set(x,y,['#ffd45e','#f3a09c','#ffffff','#e0507a'][i%4]!).set(x,y+1,LEAF_DARK)}
  return onTile(art,50)
}
