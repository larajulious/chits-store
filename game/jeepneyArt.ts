import {INK,LEAF,LEAF_DARK,LEAF_LIGHT,PixelArt,WOOD,WOOD_DARK} from './pixelArt'

// Riding a jeepney: the inside of its passenger cab, seen from the side, with the countryside rolling past the open
// windows. The cab is 180x290 art pixels (360x580 world units); the scenery layers tile sideways so they can scroll.
const noise=(x:number,y:number)=>((x*73856093)^(y*19349663))>>>0
const VINYL='#b8433a',VINYL_LIGHT='#d4574a',VINYL_DARK='#9c362e',CHROME='#c5cad0',BODY='#c8553d',BODY_DARK='#a8432f'

// The open windows (art x ranges, rows 84..162) and the windshield up front; everything else is the cab.
export const RIDE_WINDOWS=[[6,40],[47,81],[88,122],[129,145]] as const
export const RIDE_WINDSHIELD=[151,177] as const
export const RIDE_WINDOW_ROWS=[84,162] as const
export function interiorArt(){
  const art=new PixelArt(180,290)
  // Ceiling: wooden slats, a string of coloured lights, tassels, the route sign plaque and two stickers (the scene
  // letters them), and the chrome handrail running its length.
  art.rect(0,0,180,76,'#6b4630')
  for(let y=6;y<76;y+=8)art.rect(0,y,180,1,'#5e3d27')
  for(let x=4;x<178;x+=6)art.set(x,4,['#ff8a7a','#ffd45e','#a9ec8f','#7cc4e8'][(x/6|0)%4]!)
  for(let x=10;x<146;x+=12){const color=['#d9473f','#ffd45e','#5a9fc4','#79945b'][(x/12|0)%4]!;art.rect(x,5,1,6,'#3d2a1e').rect(x-1,11,3,4,color).set(x,15,color)}
  art.box(46,22,88,18,'#fff8ea','#8a6446').rect(47,23,86,1,'#ffffff')
  art.box(8,46,36,11,'#ffd45e','#a8432f').box(98,46,40,11,'#fff8ea','#4f8a83')
  art.rect(2,68,146,2,CHROME).rect(2,68,146,1,'#e6e9ec')
  for(let x=14;x<146;x+=22)art.rect(x,70,1,4,'#5f666e').box(x-2,74,5,4,'#3b3d44','#2b2430')
  // Paint and chrome above and below the window band; pillars between the windows.
  art.rect(0,76,180,8,BODY).rect(0,76,180,1,'#e07a5c').rect(0,83,180,1,CHROME)
  for(let y=84;y<162;y++)for(let x=0;x<180;x++){
    const inWindow=RIDE_WINDOWS.some(([a,b])=>x>=a&&x<=b)||(x>=RIDE_WINDSHIELD[0]&&x<=RIDE_WINDSHIELD[1]&&y<150)
    if(!inWindow)art.set(x,y,x===0||x===179?BODY_DARK:BODY)
  }
  for(const [a,b] of RIDE_WINDOWS)art.rect(a-1,84,1,78,BODY_DARK).rect(b+1,84,1,78,'#e07a5c')
  art.rect(146,84,4,78,BODY_DARK).rect(RIDE_WINDSHIELD[0]-1,84,RIDE_WINDSHIELD[1]-RIDE_WINDSHIELD[0]+3,1,INK)
  // Window sill, then the long red vinyl bench: tufted backrest, cushion and its front.
  art.rect(0,162,180,8,BODY).rect(0,162,180,1,CHROME).rect(0,169,180,1,BODY_DARK)
  art.rect(4,170,142,30,VINYL).rect(4,170,142,1,VINYL_LIGHT)
  for(let x=24;x<146;x+=20)art.rect(x,172,1,26,VINYL_DARK)
  for(let x=14;x<146;x+=20)art.set(x,184,VINYL_DARK)
  art.rect(4,200,142,6,VINYL_LIGHT).rect(4,200,142,1,'#e87a6c').rect(4,206,142,8,VINYL_DARK).rect(4,213,142,1,'#7a2a24')
  // Ribbed rubber floor, and the near bench's back across the bottom, framing the view.
  for(let y=214;y<262;y++)art.rect(0,y,180,1,(y-214)%4===3?'#33353b':'#3b3d44')
  art.rect(0,260,180,2,CHROME).rect(0,262,180,28,'#7a2a24').rect(0,262,180,2,'#a8432f')
  for(let x=10;x<180;x+=20)art.rect(x,266,1,24,'#6a2420')
  return art
}
// The driver, up front facing the road: cap, shoulders, an arm on the wheel; the dashboard with a little Santo Niño;
// and a rosary hanging from the mirror. Drawn over the cab at its front end.
export function driverArt(){
  const art=new PixelArt(34,80)
  art.rect(28,0,3,2,'#3b3d44').rect(26,2,6,3,'#3b3d44').set(28,5,'#e9b84f').set(28,7,'#e9b84f').set(27,9,'#e9b84f').set(28,11,'#e9b84f').rect(27,12,3,3,'#e9b84f')
  // Seat back, the driver from the side, the steering wheel.
  art.rect(0,40,8,40,'#7a2a24').rect(0,40,8,1,'#a8432f')
  art.ellipse(13,30,6,6,'#f3cf82').rect(7,22,12,5,'#4f8a83').rect(16,25,6,2,'#3f6a4c').set(17,30,'#2b1d16').set(18,33,'#a8432f')
  art.rect(7,36,13,18,'#f8f3e6').rect(7,36,13,1,'#ffffff').rect(18,42,9,3,'#f3cf82').rect(7,54,15,6,'#4a5f7a').rect(20,54,4,20,'#4a5f7a').rect(19,74,7,3,'#5a3b27')
  art.ellipse(28,46,2.5,8,'#2b2430').ellipse(28,46,1.2,6,'#6b4630')
  art.rect(24,58,10,8,'#3b3d44').rect(24,58,10,1,'#5a5c64').rect(29,55,3,3,'#fff1cf').set(30,54,'#f3cf82').set(30,56,'#c8553d')
  return art.outline(INK)
}

// The scenery layers are 256x64, drawn against the bottom edge with clear sky above; the scene lays copies side by side.
const TILE_W=256,TILE_H=64
const onTile=(pixels:PixelArt)=>new PixelArt(TILE_W,TILE_H).stamp(pixels,0,TILE_H-pixels.height)
// Far mountains (greys, painted for the time of day by the scene), tiling seamlessly.
export function rideRidgeArt(){
  const art=new PixelArt(TILE_W,50)
  for(let x=0;x<TILE_W;x++){
    const a=x/TILE_W*Math.PI*2,height=18+8*Math.sin(a*2+.4)+5*Math.sin(a*5+1)+3*Math.sin(a*11)
    const top=50-Math.round(height)
    for(let y=top;y<50;y++)art.set(x,y,y===top?'#ffffff':noise(x,y)%9===0?'#d8d8d8':'#ececec')
  }
  return onTile(art)
}
// The middle distance, in its own colours: rice paddies with glints of water, then a stretch of coast with the sea,
// a little island and a bangka. Both ends match so it tiles.
export function rideFieldsArt(){
  const art=new PixelArt(TILE_W,40),seaTop=8
  for(let x=0;x<TILE_W;x++){
    const coast=x>=128&&x<244
    for(let y=0;y<40;y++){
      let color:string
      if(coast){
        const shore=26+Math.round(Math.sin(x/9)*1.5)
        color=y<seaTop?'#00000000':y<shore?(noise(x,y)%13===0?'#a9d8ea':y===seaTop?'#7cc4e8':'#4f9ac4'):y<shore+3?'#f1e2b0':'#8fbf6a'
      }else{
        const row=(y+Math.floor(x/30))%7
        color=y<seaTop+2?'#00000000':row===0?'#a9d8ea':row===1?'#7cb662':noise(x,y)%17===0?'#a8d686':'#8fbf6a'
      }
      if(!color.startsWith('#00000000'))art.set(x,y,color)
    }
  }
  // An island and a bangka with its outriggers.
  art.ellipse(170,seaTop+1,14,4,'#5c8a5a').rect(156,seaTop+1,28,2,'#4f7d4a')
  art.rect(210,18,12,2,'#fff8ea').rect(212,20,8,1,'#c8553d').rect(207,19,18,1,'#6b4630').rect(215,13,1,5,'#6b4630').rect(216,13,4,4,'#fff1cf')
  // Bushes along the paddies' edge.
  for(let x=4;x<128;x+=13)art.ellipse(x,seaTop+3,4,2.6,'#5c9a4a').set(x-1,seaTop+1,'#7cb662')
  return onTile(art)
}
// Close to the road, passing quickly: coconut palms, a nipa hut on stilts, an electric post with its wires,
// bougainvillea, on a strip of grass. Wires and grass run edge to edge so it tiles.
export function rideRoadsideArt(){
  const art=new PixelArt(TILE_W,48),grass='#5c9a4a'
  art.rect(0,40,TILE_W,8,grass).rect(0,40,TILE_W,1,LEAF_LIGHT)
  for(let x=0;x<TILE_W;x+=3)art.set(x,39,LEAF_DARK)
  art.rect(0,9,TILE_W,1,'#3b3d44').rect(0,13,TILE_W,1,'#3b3d44')
  const palm=(x:number,lean:number)=>{
    for(let y=8;y<41;y++)art.rect(x+Math.round((40-y)*lean/32),y,2,1,(y%4===0)?'#8a6446':'#a07850')
    const cx=x+lean,cy=8
    for(const [dx,dy,len] of [[-1,0,10],[1,0,10],[-1,1,8],[1,1,8],[0,-1,6]] as const)
      for(let i=0;i<len;i++)art.set(cx+dx*i,cy+Math.round(dy*i*.6+(dx?i*i/18:0)),i%3===0?LEAF_LIGHT:LEAF)
    art.rect(cx-1,cy+1,3,2,'#6b4630')
  }
  palm(18,3);palm(110,-2);palm(222,2)
  // Nipa hut: stilts, woven walls, a window and a thatched roof.
  art.rect(52,32,2,8,WOOD_DARK).rect(76,32,2,8,WOOD_DARK).rect(50,22,30,10,'#d9b07a').rect(50,22,30,1,'#e8c690')
  for(let x=52;x<80;x+=3)art.rect(x,23,1,9,'#c99a63')
  art.rect(58,25,6,5,'#5e3d27').rect(70,26,5,6,WOOD)
  for(let i=0;i<8;i++)art.rect(48+i,21-i,36-i*2,1,i%2?'#b08a50':'#c8a060')
  // The post and its crossbar, and bougainvillea by the road.
  art.rect(162,4,3,37,'#8a6446').rect(158,8,11,2,'#6b4630')
  for(const [x,color] of [[130,'#e0507a'],[140,'#f08ab0'],[184,'#e0507a'],[246,'#f6c445']] as const){art.ellipse(x,37,5,3.5,LEAF_DARK);for(let i=0;i<5;i++)art.set(x-3+i*2-(i%2),35+(i%2),color)}
  return onTile(art)
}
// The road ahead and behind the jeepney: asphalt with a centre line.
export function rideRoadArt(){
  const art=new PixelArt(TILE_W,48).rect(0,0,TILE_W,48,'#6a6370').rect(0,0,TILE_W,2,'#c9b48f').rect(0,2,TILE_W,1,'#565061')
  for(let y=3;y<48;y++)for(let x=0;x<TILE_W;x++)if(noise(x,y)%29===0)art.set(x,y,'#5d5763')
  for(let x=4;x<TILE_W;x+=64)art.rect(x,22,26,2,'#fff1cf')
  return onTile(art.rect(0,46,TILE_W,2,'#565061'))
}
