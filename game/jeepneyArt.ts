import {INK,LEAF,LEAF_DARK,LEAF_LIGHT,PixelArt,WOOD,WOOD_DARK,WOOD_LIGHT} from './pixelArt'

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
// A wave around the tile: whole periods only, so a layer built from waves tiles seamlessly.
const wave=(x:number,periods:number,phase=0)=>Math.sin(x/256*Math.PI*2*periods+phase)
// Far mountains (greys, painted in the sky's colours) along a height profile; shaded slopes face away from the sun.
function ridgeArt(heightAt:(x:number)=>number,shaded=false){
  const art=new PixelArt(256,50)
  for(let x=0;x<256;x++){
    const top=50-Math.round(Math.min(48,heightAt(x))),shade=shaded&&heightAt(x+1)<heightAt(x)
    for(let y=top;y<50;y++)art.set(x,y,y===top?'#ffffff':noise(x,y)%9===0?'#d8d8d8':shade?'#e0e0e0':'#ececec')
  }
  return onTile(art)
}
export function rideRidgeArt(){return ridgeArt(x=>18+8*wave(x,2,.4)+5*wave(x,5,1)+3*wave(x,11))}
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

// The trip's legs, in the order the jeepney drives them: along the Tagaytay ridge above Taal Lake, up Kennon Road to
// Baguio past the Lion's Head, through the rice fields under Mayon in Albay, then into the city along EDSA.
export const RIDE_LEGS=['taal','baguio','mayon','edsa'] as const
export type RideLeg=typeof RIDE_LEGS[number]
export type RideLayer='ridge'|'fields'|'roadside'|'road'|'verge'

// Tagaytay: the low mountains across the lake (Mt. Maculot standing up among them), Taal Lake below the ridge with its
// fish pens and a bangka, and the volcano island out on the water.
export function taalRidgeArt(){return ridgeArt(x=>9+3*wave(x,2,1)+2*wave(x,5,.3)+1.2*wave(x,13)+11*Math.exp(-(((x-70)/12)**2)))}
export function taalLakeArt(){
  const art=new PixelArt(256,40),top=6
  for(let x=0;x<256;x++){
    // The near slope of the Tagaytay ridge runs along the bottom.
    const slope=33+Math.round(wave(x,3)*2+wave(x,7))
    for(let y=top;y<40;y++){
      if(y>=slope)art.set(x,y,y===slope?LEAF_LIGHT:noise(x,y)%7===0?LEAF_DARK:'#6fa856')
      else art.set(x,y,y<top+2?'#7aa38a':noise(x,y)%17===0?'#cfe9f2':y<top+8?'#8ccbe8':y<top+16?'#6fb6dc':'#5aa8d0')
    }
  }
  // Fish pens: rows of little bamboo frames on the water.
  for(const [px,py] of [[22,20],[150,24]] as const)for(let i=0;i<4;i++)for(let j=0;j<2;j++){const x=px+i*8,y=py+j*4;art.rect(x,y,7,1,WOOD_DARK).rect(x,y+2,7,1,WOOD_DARK).set(x,y+1,WOOD_DARK).set(x+6,y+1,WOOD_DARK)}
  art.rect(100,15,12,2,'#fff8ea').rect(102,17,8,1,RED).rect(97,16,18,1,WOOD_DARK).rect(105,10,1,5,WOOD_DARK).rect(106,10,4,4,'#fff1cf')
  return onTile(art)
}
// Taal Volcano island, low on the lake: the main crater's notch with a wisp of steam, and the steep little cone of
// Binintiang Malaki at its western end.
export function taalVolcanoArt(){
  const art=new PixelArt(130,40),base=36
  const crater=(x:number)=>Math.abs(x-80)<12?6*(1-((x-80)/12)**2):0
  const island=(x:number)=>20*Math.exp(-(((x-76)/34)**2))+3*Math.sin(x/5)*Math.exp(-(((x-76)/40)**2))-crater(x)
  const cone=(x:number)=>24*Math.max(0,1-Math.abs(x-30)/14)**1.2
  for(let x=0;x<130;x++){
    const h=Math.round(Math.max(island(x+.5),cone(x+.5)))
    if(h<1)continue
    const top=base-h,onCone=cone(x+.5)>=island(x+.5),rim=!onCone&&crater(x)>.5
    const shade=onCone?x>=30:Math.max(island(x+1.5),cone(x+1.5))<Math.max(island(x+.5),cone(x+.5))
    for(let y=top;y<base;y++){
      const gully=onCone&&y>top+1&&Math.round((x-30)*8/(y-top+6))%3===0
      art.set(x,y,y===top?(rim?'#c2b28c':'#9cc072'):rim&&y<top+3?'#a8977a':gully?'#4f7a3e':noise(x,y)%6===0?'#557e42':shade?'#5c8646':'#6b9850')
    }
  }
  // The crater lake in the notch, a wisp of steam, and the ripples where the island meets the water.
  art.rect(73,base-15,14,1,'#c9d98a').rect(75,base-14,10,1,'#a9c46a')
  for(const [x,y,r] of [[80,16,2.5],[83,12,3],[87,8,2.5]] as const)art.ellipse(x,y,r,r*.8,'#f4f4f4')
  for(let x=10;x<124;x++)art.set(x,base+(x%5===0?1:0),'#cfe9f2').set(x,base+2,x%3===0?'#a9d8ea':null)
  return art
}
// The Tagaytay roadside: shady trees, a fruit stand hung with pineapples and stacked with buko, a bulalo eatery with
// its pot steaming outside, and the power lines.
export function tagaytayRoadsideArt(){
  const art=new PixelArt(256,56)
  art.rect(0,48,256,8,'#5c9a4a').rect(0,48,256,1,LEAF_LIGHT)
  for(let x=0;x<256;x+=3)art.set(x,47,LEAF_DARK)
  art.rect(0,11,256,1,'#3b3d44').rect(0,15,256,1,'#3b3d44')
  const tree=(x:number,top:number)=>{art.rect(x,top+8,3,48-top-8,'#7a5a3e').rect(x,top+8,1,48-top-8,'#8a6a4a').ellipse(x+1,top+6,11,7,LEAF_DARK).ellipse(x-2,top+4,7,5,LEAF).ellipse(x+4,top+3,5,4,LEAF_LIGHT)}
  tree(18,2);tree(204,6);tree(238,0)
  // Fruit stand: red tin roof, pineapples hanging from its edge, buko and more pineapples on the counter.
  art.rect(62,22,2,26,WOOD_DARK).rect(106,22,2,26,WOOD_DARK).rect(56,18,58,4,RED).rect(56,18,58,1,'#e0705a').rect(56,21,58,1,RED_DARK)
  const pineapple=(x:number,y:number)=>{art.ellipse(x,y+3,2,3,YELLOW).set(x-1,y+2,'#d9a02c').set(x+1,y+4,'#d9a02c').set(x,y,LEAF).set(x-1,y-1,LEAF).set(x+1,y-1,LEAF_DARK)}
  for(let x=67;x<104;x+=7)pineapple(x,23)
  art.rect(60,38,50,10,WOOD).rect(60,38,50,1,WOOD_LIGHT)
  for(let x=64;x<84;x+=5)art.ellipse(x,36,2.5,2.5,'#6aa84f').set(x-1,35,'#8ccc6a')
  for(let x=88;x<108;x+=5)pineapple(x,32)
  // The bulalo eatery and its pot.
  art.rect(134,30,40,18,'#f3e3c3').rect(134,30,40,1,'#fff1cf')
  for(let i=0;i<8;i++)art.rect(130+i,29-i,48-i*2,1,i%2?'#b08a50':'#c8a060')
  art.rect(140,36,7,12,WOOD_DARK).rect(154,35,12,6,'#7cc4e8').rect(154,35,12,1,'#5e3d27')
  art.rect(180,44,8,4,'#3b3d44').ellipse(184,43,5,2,'#5a5c64').rect(181,47,2,1,'#e0533f').rect(185,47,2,1,'#e0533f')
  for(const [x,y] of [[183,40],[185,38],[184,36],[186,34]] as const)art.set(x,y,'#f4f4f4')
  return onTile(art)
}

// Baguio: the Cordillera standing up behind, pine-covered hills with a hillside of brightly painted houses, and the
// pines and cut rock of Kennon Road; the Lion's Head looks out over the road.
export function cordilleraArt(){return ridgeArt(x=>27+9*wave(x,2,.4)+6*wave(x,5,1.3)+5*Math.abs(wave(x,7)),true)}
export function baguioHillsArt(){
  const art=new PixelArt(256,40),crest=(x:number)=>6+Math.round(3*wave(x,2,.5)+2*wave(x,5))
  for(let x=0;x<256;x++)for(let y=crest(x);y<40;y++)art.set(x,y,y===crest(x)?'#6f9a5a':noise(x,y)%5===0?'#3f6a42':'#4f7d4a')
  for(let x=3;x<256;x+=5+noise(x,1)%3){const h=4+noise(x,2)%3,top=crest(x)-h;for(let r=0;r<=h;r++){const w=Math.floor(r/2);art.rect(x-w,top+r,w*2+1,1,r%2?'#2f5a3a':'#3a6644')}}
  const colors=['#e0507a','#f6c445','#7cc4e8','#a9ec8f','#ff8a5a','#fff1cf','#b48ae0','#5aa8d0']
  for(let y=12;y<36;y+=4)for(let x=112;x<210;x+=5){
    if(((x-160)/46)**2+((y-28)/16)**2>1||noise(x,y)%4===0)continue
    const c=colors[noise(x,y+1)%colors.length]!,dx=noise(x,y)%2
    art.rect(x+dx,y,4,3,c).rect(x+dx,y,4,1,'#9a3f3a').set(x+dx+1,y+2,'#3b3d44')
  }
  return onTile(art)
}
export function kennonRoadsideArt(){
  const art=new PixelArt(256,56)
  art.rect(0,48,256,8,'#5f8a52').rect(0,48,256,1,'#7aa266')
  // The rock face the road was cut through, in layered strata, with ferns in its cracks.
  for(let x=86;x<174;x++){
    const top=20+Math.round(3*Math.sin((x-86)/88*Math.PI*3)+8*(1-Math.sin((x-86)/88*Math.PI)))
    for(let y=top;y<48;y++)art.set(x,y,y===top?'#c2b8a6':(y+Math.round(Math.sin(x/9)*2))%6===0?'#7a7064':noise(x,y)%7===0?'#6e6458':x%13===0&&y>top+3?'#857a6c':'#9a8f80')
  }
  for(const [x,y] of [[96,38],[118,30],[134,42],[150,32],[166,40]] as const)art.set(x,y,LEAF).set(x-1,y+1,LEAF_DARK).set(x+1,y+1,LEAF_DARK).set(x,y+1,LEAF_LIGHT).set(x-2,y+2,LEAF_DARK).set(x+2,y+2,LEAF_DARK)
  const pine=(x:number,top:number)=>{
    art.rect(x,top+4,2,48-top-4,'#6b4630')
    for(let y=top;y<top+(48-top)*.78;y++){const w=Math.round((y-top)*.32)+1-(y%4===0?1:0);art.rect(x+1-w,y,w*2,1,y%4<2?'#2f5a3a':'#3f6e46')}
  }
  pine(18,0);pine(46,10);pine(74,4);pine(190,2);pine(218,12);pine(240,16)
  return onTile(art)
}
export function kennonVergeArt(){
  const art=new PixelArt(256,50).rect(0,6,256,44,'#5c8a4a').rect(0,6,256,1,LEAF_LIGHT)
  for(let x=0;x<256;x++)for(let y=7;y<50;y++){const n=noise(x,y)%23;if(n===0)art.set(x,y,LEAF_LIGHT);else if(n===1)art.set(x,y,'#8a6a4a')}
  // A steel guardrail on short posts.
  for(let x=4;x<256;x+=24)art.rect(x,2,2,13,'#7f8890')
  art.rect(0,3,256,4,CHROME).rect(0,3,256,1,'#f0f2f4').rect(0,5,256,1,CHROME_SHADE)
  // Wild sunflowers.
  for(let i=0;i<14;i++){
    const x=(i*67+9)%256,y=20+(i*23)%24
    art.rect(x,y+2,1,4,LEAF_DARK).set(x-1,y,YELLOW).set(x+1,y,YELLOW).set(x,y-1,YELLOW).set(x,y+1,YELLOW).set(x,y,'#7a4f31')
  }
  return onTile(art,50)
}
// The Lion's Head: the great carved lion looking out over Kennon Road from its stone base.
export function lionsHeadArt(){
  const art=new PixelArt(64,92),MANE='#c9954a',MANE_DARK='#a0703a',FACE='#e3b871',FACE_DARK='#c99a58'
  art.rect(6,70,52,22,'#8f8a80').rect(6,70,52,1,'#b5aea2')
  for(let x=8;x<56;x+=9)art.rect(x,72,1,18,'#77726a')
  for(let y=76;y<92;y+=6)art.rect(6,y,52,1,'#77726a')
  art.ellipse(4,86,5,6,LEAF_DARK).ellipse(60,84,5,8,LEAF_DARK).ellipse(3,84,3,3,LEAF).ellipse(61,81,3,4,LEAF)
  // The mane, strands raying out, then the ears, the face, brows and eyes, the nose and muzzle, and the open mouth.
  art.ellipse(32,40,29,31,MANE)
  for(let a=0;a<Math.PI*2;a+=Math.PI/14)for(let d=18;d<30;d++)art.set(Math.round(32+Math.cos(a)*d),Math.round(40+Math.sin(a)*d*1.06),MANE_DARK)
  art.ellipse(16,18,5,5,MANE_DARK).ellipse(48,18,5,5,MANE_DARK).ellipse(16,18,2.5,2.5,FACE_DARK).ellipse(48,18,2.5,2.5,FACE_DARK)
  art.ellipse(32,44,17,20,FACE).ellipse(32,30,12,6,'#ecc788')
  art.rect(21,35,8,2,FACE_DARK).rect(35,35,8,2,FACE_DARK).rect(23,38,4,3,'#2b1d16').rect(37,38,4,3,'#2b1d16').set(24,38,'#fff6de').set(38,38,'#fff6de')
  art.rect(30,32,4,14,'#ecc788').rect(27,46,10,3,'#5e3d27').rect(28,49,8,1,'#5e3d27')
  art.ellipse(26,52,6,4,'#ecc788').ellipse(38,52,6,4,'#ecc788')
  art.rect(25,56,14,6,'#6b2a24').rect(26,56,2,2,'#fff6de').rect(36,56,2,2,'#fff6de').rect(28,61,8,1,'#d9606a')
  art.ellipse(32,64,8,2.5,FACE_DARK)
  return art.outline(INK)
}

// Albay: Mayon's near-perfect cone rising over the rice fields, its slopes ash grey above and green below, gullies
// running down from the summit, a plume drifting from the crater and a wisp of cloud on its flank.
export function mayonArt(){
  const art=new PixelArt(140,100),peak=70
  for(let x=0;x<140;x++){
    const d=Math.abs(x+.5-peak)/70
    if(d>=1)continue
    const top=100-(Math.round(88*(1-d)**1.7)+2),right=x>=peak
    for(let y=top;y<100;y++){
      const gully=y>top+1&&y<70&&Math.round((x-peak)*30/(y+8))%4===0
      art.set(x,y,y===top?'#f0ece4':y<40?(gully?'#b9b1a5':right?'#cbc5ba':'#d6d0c6'):y<64?(gully?'#9ea48a':right?'#a8b092':'#b4bc9c'):noise(x,y)%5===0?'#7a9f68':right?'#83a671':'#8fb07a')
    }
  }
  for(const [x,y,rx,ry,color] of [[74,8,4,3,'#ffffff'],[81,6,5,3.5,'#f6f6f6'],[90,5,6,3,'#eeeeee'],[100,5,6,2.5,'#e6e6e6']] as const)art.ellipse(x,y,rx,ry,color)
  art.ellipse(40,58,13,2.5,'#ffffff').ellipse(46,57,7,2,'#f6f6f6')
  return art
}

// EDSA: the towers of Ortigas and Makati, the MRT-3 viaduct with its trains, billboards, lamp posts and a waiting shed,
// the wide avenue with its concrete median, and the sidewalk behind the pink MMDA railing.
export function skylineArt(){
  const art=new PixelArt(256,50)
  for(let x=0,i=0;x<256;i++){
    const w=8+noise(i,1)%12,top=50-(12+noise(i,2)%34)
    for(let bx=x;bx<x+w;bx++)for(let y=top;y<50;y++)art.set(bx,y,y===top?'#ffffff':bx===x?'#f6f6f6':bx===x+w-1?'#d2d2d2':'#e8e8e8')
    for(let y=top+3;y<48;y+=3)for(let bx=x+2;bx<x+w-2;bx+=2)art.set(bx,y,'#cfcfcf')
    if(noise(i,3)%4===0)art.rect(x+(w>>1),top-4,1,4,'#d8d8d8')
    x+=w+noise(i,4)%3
  }
  return onTile(art)
}
export function mrtViaductArt(){
  const art=new PixelArt(256,40),colors=['#e0cfa8','#c9d3dc','#e3b9a0','#d8d8c8','#b9c8b0']
  for(let x=0,i=0;x<256;i++){
    const w=10+noise(i,5)%14,top=40-(14+noise(i,6)%20),c=colors[noise(i,7)%colors.length]!
    art.rect(x,top,w,40-top,c).rect(x,top,w,1,'#f4efe6')
    for(let y=top+3;y<38;y+=4)for(let bx=x+2;bx<x+w-2;bx+=3)art.rect(bx,y,2,2,'#8a98a8')
    x+=w
  }
  art.rect(0,37,256,3,'#a9a39a')
  // The track: catenary poles and wire, the parapet, and the concrete beam on its T-capped pillars.
  for(let x=10;x<256;x+=32)art.rect(x,1,1,8,'#7f8890')
  art.rect(0,2,256,1,'#7f8890')
  for(let x=0;x<256;x+=4)art.set(x,8,'#9aa3ab')
  art.rect(0,9,256,1,'#9aa3ab').rect(0,10,256,5,'#c9c4ba').rect(0,10,256,1,'#e6e2da').rect(0,14,256,1,'#9e978c')
  for(const x of [20,84,148,212])art.rect(x-3,15,10,2,'#bdb7ac').rect(x,17,4,20,'#bdb7ac').rect(x+3,17,1,20,'#9e978c')
  return onTile(art)
}
// An MRT-3 train of three cars, heading left along the viaduct.
export function mrtTrainArt(){
  const art=new PixelArt(126,16)
  for(let c=0;c<3;c++){
    const x=c*43
    art.rect(x,1,40,13,'#f4f4f0').rect(x+1,0,38,1,'#d5d9de').rect(x+2,4,36,4,'#2b2c33')
    for(let wx=x+8;wx<x+38;wx+=7)art.rect(wx,4,1,4,'#f4f4f0')
    art.rect(x+12,3,4,10,'#e2e2dc').rect(x+28,3,4,10,'#e2e2dc').rect(x,9,40,2,'#3a6fb0').rect(x,11,40,1,RED)
    art.rect(x+4,14,8,2,'#3b3d44').rect(x+28,14,8,2,'#3b3d44')
    if(c<2)art.rect(x+40,8,3,2,'#3b3d44')
  }
  art.set(0,1,null).set(0,2,null).set(1,1,null).rect(0,4,2,4,'#2b2c33').set(1,10,'#fff3c4')
  return art.outline(INK)
}
export function edsaRoadsideArt(){
  const art=new PixelArt(256,56)
  art.rect(0,48,256,8,'#bdb7ac').rect(0,48,256,1,'#d6d1c7')
  for(let x=0;x<256;x+=16)art.rect(x,49,1,7,'#a9a39a')
  const billboard=(x:number,y:number,w:number,h:number)=>{art.rect(x+w/4,y+h,3,48-y-h,'#7f8890').rect(x+w*3/4-3,y+h,3,48-y-h,'#7f8890').rect(x,y-1,w,1,'#7f8890').rect(x,y+h,w,1,'#7f8890')}
  billboard(14,2,70,24)
  art.box(14,2,70,24,'#5aa8d0','#3b3d44').ellipse(31,14,8,8,YELLOW).ellipse(31,14,5,5,'#fff1b0').rect(46,7,32,3,'#ffffff').rect(46,13,26,2,'#fff1cf').rect(46,17,20,2,'#fff1cf')
  billboard(168,6,62,20)
  art.box(168,6,62,20,'#f4efe6','#3b3d44').rect(169,7,60,6,RED).rect(174,16,40,2,'#3b3d44').rect(174,20,28,2,'#7f8890')
  // A waiting shed with its bench, then lamp posts.
  art.rect(102,30,50,3,'#3a6fb0').rect(102,30,50,1,'#5a8fd0').rect(106,33,2,15,'#7f8890').rect(146,33,2,15,'#7f8890')
  art.rect(110,34,34,7,YELLOW).rect(114,36,20,1,'#3b3d44').rect(112,43,30,2,WOOD)
  for(const x of [94,160,246])art.rect(x,8,2,40,'#7f8890').rect(x-6,8,7,1,'#7f8890').rect(x-8,8,4,2,'#fff3c4')
  return onTile(art)
}
export function edsaRoadArt(){
  const art=new PixelArt(256,60).rect(0,0,256,60,'#5f5a66')
  for(let y=0;y<60;y++)for(let x=0;x<256;x++)if(noise(x,y)%29===0)art.set(x,y,'#54505b')
  art.rect(0,0,256,3,'#bdb7ac').rect(0,3,256,1,'#9e978c').rect(0,5,256,1,'#e6e2da')
  for(let x=4;x<256;x+=24)art.rect(x,14,12,1,'#e6e2da').rect(x,42,12,1,'#e6e2da')
  art.rect(0,28,256,4,'#d6d1c7').rect(0,28,256,1,'#eeeae2').rect(0,31,256,1,'#a9a39a')
  for(let x=6;x<256;x+=16)art.rect(x,29,3,2,YELLOW)
  return onTile(art.rect(0,55,256,1,'#e6e2da').rect(0,58,256,2,'#4c4756'),60)
}
export function edsaVergeArt(){
  const art=new PixelArt(256,50).rect(0,6,256,44,'#c9c4ba')
  for(let x=0;x<256;x+=16)art.rect(x,6,1,44,'#b5afa5')
  for(let y=16;y<50;y+=10)art.rect(0,y,256,1,'#b5afa5')
  for(let x=2;x<256;x+=3)art.rect(x,4,1,6,'#f08ab0')
  for(let x=0;x<256;x+=16)art.rect(x,0,2,13,'#d06a90')
  art.rect(0,2,256,2,'#f08ab0').rect(0,3,256,1,'#d06a90').rect(0,9,256,2,'#f08ab0').rect(0,10,256,1,'#d06a90')
  for(const x of [40,168])art.box(x,22,22,8,'#9e978c','#7f7a70').ellipse(x+11,21,10,4,LEAF).ellipse(x+8,19,5,2.5,LEAF_LIGHT)
  art.ellipse(112,38,6,2.5,'#7f7a70').ellipse(112,38,4,1.5,'#8f8a80')
  return onTile(art,50)
}

// Every leg's scenery layers and its landmark. Mayon's leg keeps the original countryside: paddies, coast and carabao.
export const LEG_SCENERY:Record<RideLeg,Record<RideLayer|'landmark',()=>PixelArt>>={
  taal:{ridge:taalRidgeArt,fields:taalLakeArt,roadside:tagaytayRoadsideArt,road:rideRoadArt,verge:rideVergeArt,landmark:taalVolcanoArt},
  baguio:{ridge:cordilleraArt,fields:baguioHillsArt,roadside:kennonRoadsideArt,road:rideRoadArt,verge:kennonVergeArt,landmark:lionsHeadArt},
  mayon:{ridge:rideRidgeArt,fields:rideFieldsArt,roadside:rideRoadsideArt,road:rideRoadArt,verge:rideVergeArt,landmark:mayonArt},
  edsa:{ridge:skylineArt,fields:mrtViaductArt,roadside:edsaRoadsideArt,road:edsaRoadArt,verge:edsaVergeArt,landmark:mrtTrainArt},
}
