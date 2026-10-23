import Phaser from 'phaser'
import {avatarOptions} from '../shared/avatars'
import * as art from './pixelArt'
import * as deck from './deckArt'
import {bigPotArt,glowArt,lightPoolArt} from './neighborhoodArt'
import {manilaMinute,mixColor,moonArc,skyAt,skyPhase,sunArc,volcanoSmoke,type Sky,type SkyPhase} from './scenery'
import {PX,VIEW_H,addTexture,drawRain} from './common'

// The Tanaw Deck: an open-air deck beside a room (the café's and the store's), facing layered mountains and a lake
// with a volcano island. Each scene that has one is 720 units wide: the room at x 0..360, the deck at 360..720.
// This module draws the view and the deck's furniture and keeps the sky in step with the clock; the scene keeps its
// visitors, seats and taps.
export const DECK_LEFT=372,RAIL_Y=300
// The two benches facing the view (each seats two, at x-20 and x+20 on y 400), the pots in the front corners, and the
// string of lights between two posts at the railing's ends.
export const DECK_BENCHES=[460,620] as const
export const DECK_POTS=[{x:392,y:520},{x:688,y:520}]
const WIRE={x0:382,x1:706,y:232,sag:22}
const wireY=(x:number)=>WIRE.y+Math.round(Math.sin((x-WIRE.x0)/(WIRE.x1-WIRE.x0)*Math.PI)*WIRE.sag/PX)*PX
const DECK_BULBS=Array.from({length:12},(_,i)=>{const x=WIRE.x0+18+i*26;return {x,y:wireY(x)+4}})
// Thirty fixed stars over the whole view, brightest few first.
const STARS=Array.from({length:30},(_,i)=>({x:Math.round((DECK_LEFT+((i*137)%880))/PX)*PX,y:Math.round((8+((i*61)%140))/PX)*PX,bright:i<6}))
// The notch of the island's crater (world units): where the plume rises from, just inside it so the island hides its base.
const CRATER={x:561,y:234}
// The view's layers, back to front, all below the deck floor and the room's furniture.
const DEPTH={sky:.1,stars:.12,glow:.14,sun:.15,cloud:.2,far:.3,lake:.35,smoke:.38,island:.4,near:.45,lights:.5,floor:.9,shade:.95,wall:1}
// Little thoughts a visitor has out on the deck, for the time of day (only they see them).
const VALLEY_LINES:Record<SkyPhase,string[]>={
  morning:['Ang fresh ng hangin sa probinsya.','Ang ganda ng palayan ngayong umaga.','Ang ganda ng view.'],
  afternoon:['Ang luntian ng lambak!','Perfect tambayan spot.','Sarap tumambay dito.'],
  sunset:['Sunset sa lambak. Ang ganda!','Golden hour sa palayan.','Sarap tumambay dito.'],
  night:['Ang ganda ng mga ilaw sa baryo.','Tahimik na gabi sa lambak.','Sarap tumambay dito.'],
}
const VIEW_LINES:Record<SkyPhase,string[]>={
  morning:['Ang fresh ng hangin ngayong umaga.','Kape at hamog sa umaga. Perfect.','Ang ganda ng view.'],
  afternoon:['Ang ganda ng view.','Perfect tambayan spot.','Sarap tumambay dito.'],
  sunset:['Sunset hits different here.','Golden hour na! Ang ganda.','Sarap tumambay dito.'],
  night:['Ang calming ng moonlight tonight.','Ang ganda ng buwan ngayong gabi.','Tahimik. Sarap tumambay dito.'],
}
const RAIN_LINES=['Umuulan! Sarap magkape.','Ulan, kape at kwentuhan. Perfect.','Ang lamig ng hangin sa ulan.']
const SMOKE_LINES=['Uy, may usok ang bulkan. Ang ganda tingnan.','Nag-steam na naman ang bulkan.']
const pick=<T>(lines:readonly T[])=>lines[Math.floor(Math.random()*lines.length)]!

// Floor footprints of the deck: the room/deck wall (above and below the doorway, the lower part reaching past the floor's
// front edge whatever the doorway's height), the railing, the benches and the pots.
export function deckObstacles(doorway:deck.Doorway){
  return [
    {x:344,y:250,w:32,h:doorway.top+7-250},{x:344,y:doorway.bottom-2,w:32,h:VIEW_H-(doorway.bottom-2)},{x:376,y:250,w:344,h:RAIL_Y-251},
    ...DECK_BENCHES.map(x=>({x:x-40,y:378,w:80,h:20})),...DECK_POTS.map(p=>({x:p.x-16,y:p.y-12,w:34,h:30})),
  ]
}
// The deck's furniture, and visitors seen from behind (leaning on the rail, or sitting on a bench facing the view).
export function createDeckTextures(scene:Phaser.Scene,doorway:deck.Doorway){
  const texture=(name:string,pixels:art.PixelArt)=>addTexture(scene,name,pixels)
  for(const option of avatarOptions){
    const id=option.id
    texture(`${id}-lean`,deck.backVisitorArt(id,'lean'));texture(`${id}-lean-wave`,deck.backVisitorArt(id,'lean',true))
    texture(`${id}-back-sit`,deck.backVisitorArt(id,'sit'));texture(`${id}-back-sit-wave`,deck.backVisitorArt(id,'sit',true))
  }
  texture('deck-moon',deck.moonArt());texture('deck-floor',deck.deckFloorArt());texture('deck-wall',deck.partitionArt(doorway));texture('deck-sign',deck.deckSignArt())
  texture('deck-post',deck.lightPostArt());texture('bench-seat',deck.benchSeatArt());texture('bench-back',deck.benchBackArt())
  texture('light-pool',lightPoolArt());texture('bulb-glow',glowArt(9,'#ffd98a'));texture('big-pot',bigPotArt())
}

// A grey texture painted in one colour, like a tint. Painting the pixels looks the same in WebGL and in Phaser's Canvas
// renderer (which low-end devices fall back to, and which ignores tints), and only happens when the colour changes.
export class PaintedTexture{
  private source:Uint8ClampedArray
  private texture:Phaser.Textures.CanvasTexture
  private color=-1
  constructor(scene:Phaser.Scene,key:string,pixels:art.PixelArt){
    this.source=pixels.toCanvas().getContext('2d')!.getImageData(0,0,pixels.width,pixels.height).data
    this.texture=scene.textures.createCanvas(key,pixels.width,pixels.height)!
  }
  paint(color:number){
    if(color===this.color)return
    this.color=color
    const {context,width,height}=this.texture,image=context.createImageData(width,height),source=this.source,data=image.data
    const r=(color>>16&255)/255,g=(color>>8&255)/255,b=(color&255)/255
    for(let i=0;i<source.length;i+=4){data[i]=source[i]!*r;data[i+1]=source[i+1]!*g;data[i+2]=source[i+2]!*b;data[i+3]=source[i+3]!}
    context.putImageData(image,0,0);this.texture.refresh()
  }
}
type Orb={body:Phaser.GameObjects.Image;glow:Phaser.GameObjects.Image}
// skyMinute: a fixed time of day (the page's ?time= preview); otherwise the store's Manila clock.
// rainy: whether it is raining on the deck (the café jukebox's rainy mood). lightDepth: the scene's added-light depth,
// below name tags: the doorway's sunset glow sits just under it and the rain just over it. signX: where the VIEW DECK
// sign hangs over the doorway (further onto the deck where the room has something tall by the wall). landscape: the
// café's lake with its steaming volcano island (the default), or the store's green valley with a village, its own
// mountains, the hillside the other way round and party-coloured string lights.
type ViewOptions={doorway:deck.Doorway;sceneWidth:number;lightDepth:number;skyMinute?:number;signX?:number;landscape?:deck.Landscape;reducedMotion:()=>boolean;rainy:()=>boolean}
const PARTY_BULBS=[[0xff8a7a,0xf3c6c2],[0xffd45e,0xf6e6b0],[0xa9ec8f,0xd8eecb],[0x7cc4e8,0xcfe6f2]] as const

export class TanawView{
  sky:Sky=skyAt(0)
  phase:SkyPhase='night'
  private skyKey=''
  private painted:{texture:PaintedTexture;color:(sky:Sky)=>number}[]=[]
  private skyGfx:Phaser.GameObjects.Graphics
  private starGfx:Phaser.GameObjects.Graphics
  private lakeFx:Phaser.GameObjects.Graphics
  private smokeGfx:Phaser.GameObjects.Graphics
  private rainFx:Phaser.GameObjects.Graphics
  private deckShade:Phaser.GameObjects.Graphics
  private wire:Phaser.GameObjects.Graphics
  private sun:Orb
  private moon:Orb
  private clouds:{image:Phaser.GameObjects.Image;speed:number;offset:number}[]
  private bulbs:Phaser.GameObjects.Image[]
  private pools:Phaser.GameObjects.Image[]
  private doorwayGlow:Phaser.GameObjects.Image
  private villageLights?:Phaser.GameObjects.Image
  private fxFrame=-2
  private smokeKey=-2
  private rainFrame=-2
  private readonly lake:boolean
  constructor(private scene:Phaser.Scene,private opts:ViewOptions){
    this.lake=opts.landscape!=='valley'
    const D=DEPTH,{doorway}=opts
    const image=(x:number,y:number,name:string,depth:number,originY=0)=>scene.add.image(x,y,name).setOrigin(0,originY).setScale(PX).setDepth(depth)
    const sprite=(x:number,y:number,name:string,depth:number)=>scene.add.image(x,y,name).setScale(PX).setDepth(depth)
    const paint=(key:string,pixels:art.PixelArt,color:(sky:Sky)=>number)=>this.painted.push({texture:new PaintedTexture(scene,key,pixels),color})
    // Sky and lake (one Graphics), sun and moon, clouds, then the far ridge, the island and the near hills, painted for the hour.
    paint('ridge-far',deck.farRidgeArt(opts.landscape),sky=>sky.far)
    if(this.lake)paint('taal',deck.islandArt(),sky=>sky.island)
    else{
      paint('valley',deck.valleyArt(),sky=>mixColor(sky.near,sky.horizon,.3))
      // The village keeps its own colours by day and dims toward the sky's blue after dark.
      paint('village',deck.villageArt(),sky=>mixColor(0xffffff,mixColor(sky.far,0x000000,.15),Math.min(.85,sky.dark*1.5)))
    }
    paint('hills-near',deck.nearHillsArt(),sky=>sky.near);paint('hillside',deck.hillsideArt(),sky=>sky.near)
    paint('deck-sun',deck.sunArt(),sky=>mixColor(0xffffff,sky.glow,.5));paint('sky-glow',glowArt(18,'#ffffff'),sky=>sky.glow);paint('doorway-glow',glowArt(26,'#ffffff'),sky=>sky.glow)
    paint('deck-cloud',deck.cloudArt(),sky=>sky.dark>.3?mixColor(sky.mid,0xffffff,.25):mixColor(0xffffff,sky.horizon,.3))
    this.skyGfx=scene.add.graphics().setDepth(D.sky)
    this.starGfx=scene.add.graphics().setDepth(D.stars)
    const orb=(name:string)=>({glow:sprite(0,0,'sky-glow',D.glow).setBlendMode(Phaser.BlendModes.ADD),body:sprite(0,0,name,D.sun)})
    this.sun=orb('deck-sun');this.moon=orb('deck-moon')
    this.clouds=[{y:44,speed:3,offset:120},{y:96,speed:2,offset:560}].map(c=>({image:sprite(0,c.y,'deck-cloud',D.cloud),speed:c.speed,offset:c.offset}))
    this.lakeFx=scene.add.graphics().setDepth(D.lake)
    this.smokeGfx=scene.add.graphics().setDepth(D.smoke)
    image(deck.VIEW_LEFT,210,'ridge-far',D.far,1)
    if(this.lake)scene.add.image(556,252,'taal').setOrigin(.5,1).setScale(PX).setDepth(D.island)
    else{
      if(!scene.textures.exists('village-lights'))scene.textures.addCanvas('village-lights',deck.villageLightsArt().toCanvas())
      image(deck.VIEW_LEFT,320,'valley',D.lake+.01,1)
      sprite(deck.VALLEY_VILLAGE.x,deck.VALLEY_VILLAGE.y,'village',D.island).setOrigin(.5,1)
      this.villageLights=sprite(deck.VALLEY_VILLAGE.x,deck.VALLEY_VILLAGE.y,'village-lights',D.island+.01).setOrigin(.5,1).setBlendMode(Phaser.BlendModes.ADD)
    }
    // Over the valley the near hillside rises on the right instead of the left.
    image(deck.VIEW_LEFT,316,'hills-near',D.near,1).setFlipX(!this.lake);image(opts.sceneWidth,290,'hillside',D.near)
    image(360,RAIL_Y,'deck-floor',D.floor)
    this.deckShade=scene.add.graphics().setDepth(D.shade)
    image(356,0,'deck-wall',D.wall)
    const signX=opts.signX??364
    sprite(signX,doorway.top-14,'deck-sign',2)
    scene.add.text(signX,doorway.top-9,'VIEW DECK',{fontFamily:'Silkscreen, monospace',fontSize:'8px',color:'#fff0d2',resolution:scene.cameras.main.zoom}).setOrigin(.5).setDepth(3)
    // String lights between two posts at the railing's ends, with a soft pool of light under each post after dark.
    for(const x of [WIRE.x0-2,WIRE.x1+2])scene.add.image(x,RAIL_Y+22,'deck-post').setOrigin(.5,1).setScale(PX).setDepth(D.lights)
    this.wire=scene.add.graphics().setDepth(D.lights)
    this.bulbs=DECK_BULBS.map(bulb=>sprite(bulb.x,bulb.y,'bulb-glow',D.lights).setBlendMode(Phaser.BlendModes.ADD))
    this.pools=[WIRE.x0+20,WIRE.x1-20].map(x=>sprite(x,RAIL_Y+40,'light-pool',D.shade).setBlendMode(Phaser.BlendModes.ADD))
    for(const x of DECK_BENCHES){sprite(x,386,'bench-seat',395);sprite(x,396,'bench-back',405)}
    for(const pot of DECK_POTS){const potSprite=sprite(pot.x,pot.y,'big-pot',0);potSprite.setDepth(pot.y+potSprite.displayHeight/2-14)}
    // Sunset light spills in through the doorway onto the room's floor; rain falls over visitors, under name tags.
    this.doorwayGlow=sprite(340,(doorway.top+doorway.bottom)/2,'doorway-glow',opts.lightDepth-1).setBlendMode(Phaser.BlendModes.ADD)
    this.rainFx=scene.add.graphics().setDepth(opts.lightDepth+1)
    this.applySky()
    scene.time.addEvent({delay:30_000,loop:true,callback:()=>this.applySky()})
  }
  // Colours, sun and moon for the current minute. Cheap enough to check every half minute; redraws only on a change.
  applySky(){
    const minute=this.opts.skyMinute??manilaMinute(),rain=this.opts.rainy()
    // Rain brings an overcast sky: colours wash toward grey, the sun and stars hide, the lamps come on.
    const clear=skyAt(minute),grey=0x7d8896,sky:Sky=rain?{...clear,top:mixColor(clear.top,grey,.6),mid:mixColor(clear.mid,grey,.6),horizon:mixColor(clear.horizon,grey,.6),
      far:mixColor(clear.far,grey,.45),island:mixColor(clear.island,grey,.35),lake:mixColor(clear.lake,grey,.5),near:mixColor(clear.near,0x3f4a44,.3),
      warmth:clear.warmth*.2,dark:Math.max(clear.dark,.2),lights:Math.max(clear.lights,.7),stars:0,fog:Math.max(clear.fog,.5)}:clear
    const sunAt=rain?undefined:sunArc(minute),moonAt=rain?undefined:moonArc(minute)
    this.phase=skyPhase(minute);this.rainFrame=-2
    const key=JSON.stringify([sky,sunAt,moonAt])
    if(key===this.skyKey)return
    this.skyKey=key;this.sky=sky;this.fxFrame=-2
    const g=this.skyGfx,left=deck.VIEW_LEFT,width=deck.VIEW_ART_W*PX,W=this.opts.sceneWidth
    // Fifteen bands from the top of the sky to the horizon, then the lake with its far shore line and a few ripples.
    g.clear()
    for(let i=0;i<15;i++){const t=i/14;g.fillStyle(t<.6?mixColor(sky.top,sky.mid,t/.6):mixColor(sky.mid,sky.horizon,(t-.6)/.4)).fillRect(left,i*14,width,14)}
    if(this.lake){
      g.fillStyle(sky.lake).fillRect(left,206,width,RAIL_Y-206).fillStyle(mixColor(sky.lake,sky.horizon,.45)).fillRect(left,206,width,PX)
      g.fillStyle(mixColor(sky.lake,0x000000,.08))
      for(const y of [222,238,256,274])for(let x=left+(y*13)%40;x<left+width;x+=48)g.fillRect(x,y,18,PX)
    }else g.fillStyle(mixColor(sky.far,sky.near,.45)).fillRect(left,206,width,RAIL_Y-206)
    for(const {texture,color} of this.painted)texture.paint(color(sky))
    for(const cloud of this.clouds)cloud.image.setAlpha(1-sky.dark*.6)
    const place=(orb:Orb,at:number|undefined,x0:number,span:number,base:number,rise:number,alpha:number)=>{
      const visible=at!==undefined&&alpha>0
      orb.body.setVisible(visible);orb.glow.setVisible(visible)
      if(!visible)return
      const x=Math.round((x0+at*span)/PX)*PX,y=Math.round((base-Math.sin(at*Math.PI)*rise)/PX)*PX
      orb.body.setPosition(x,y).setAlpha(alpha);orb.glow.setPosition(x,y).setAlpha(alpha*.8)
    }
    place(this.sun,sunAt,392,296,196,170,1)
    place(this.moon,moonAt,404,272,204,160,Math.max(.25,sky.stars))
    // The deck floor darkens a little at night and warms at sunset; the lamps come on as the light goes.
    this.deckShade.clear().fillStyle(0x141a33,sky.dark*.45).fillRect(360,RAIL_Y,W-360,248).fillStyle(sky.glow,sky.warmth*.12).fillRect(360,RAIL_Y,W-360,248)
    this.doorwayGlow.setAlpha(sky.warmth*.9).setVisible(sky.warmth>.05)
    for(const pool of this.pools)pool.setAlpha(sky.lights*.8).setVisible(sky.lights>.05)
    this.villageLights?.setAlpha(sky.lights).setVisible(sky.lights>.05)
    const lit=sky.lights>.3
    this.wire.clear().fillStyle(0x3d2a1e)
    for(let x=WIRE.x0;x<=WIRE.x1;x+=PX)this.wire.fillRect(x,wireY(x),PX,PX)
    DECK_BULBS.forEach((bulb,i)=>{
      const [on,off]=this.lake?[0xffd98a,0xd9c8a6]:PARTY_BULBS[i%PARTY_BULBS.length]!
      this.wire.fillStyle(0x3d2a1e).fillRect(bulb.x,bulb.y-PX*2,PX/2,PX).fillStyle(lit?on:off).fillRect(bulb.x-PX/2,bulb.y-PX,PX*1.5,PX*2).fillStyle(lit?0xfff3d6:0xeee2c8).fillRect(bulb.x-PX/2,bulb.y-PX,PX/2,PX/2)
    })
  }
  // A thought for the view, for the weather and the time of day; the steaming volcano now and then.
  thought(){
    const rain=this.opts.rainy(),smoking=!rain&&this.lake&&volcanoSmoke(Date.now())>.3&&Math.random()<.5
    return pick(rain?RAIN_LINES:smoking?SMOKE_LINES:(this.lake?VIEW_LINES:VALLEY_LINES)[this.phase])
  }
  // Clouds drift, stars twinkle, light glints on the lake and morning mist slides over it; all slow, a few frames a second.
  update(){
    const scene=this.scene,now=scene.time.now,motion=!this.opts.reducedMotion(),sky=this.sky,left=deck.VIEW_LEFT,width=deck.VIEW_ART_W*PX
    if(motion)for(const cloud of this.clouds){const x=Math.round((left-70+(now/1000*cloud.speed+cloud.offset)%(width+140))/PX)*PX;if(cloud.image.x!==x)cloud.image.setX(x)}
    this.bulbs.forEach((bulb,i)=>{
      const alpha=sky.lights<.05?0:motion?Math.min(1,sky.lights-.05+Math.round((Math.sin(now/1300+i*1.3)*.5+.5)*3)/30):sky.lights
      if(bulb.alpha!==alpha)bulb.setAlpha(alpha)
    })
    this.updateRain(motion)
    this.updateSmoke(motion)
    const frame=motion?Math.floor(now/400):-1
    if(frame===this.fxFrame)return
    this.fxFrame=frame
    const stars=this.starGfx,fx=this.lakeFx
    stars.clear()
    if(sky.stars>0)STARS.forEach((star,i)=>{
      if(motion&&!star.bright&&(frame+i)%9===0)return
      stars.fillStyle(0xfff6dc,sky.stars*(star.bright?1:.6)).fillRect(star.x,star.y,star.bright?PX:PX/2,star.bright?PX:PX/2)
    })
    fx.clear()
    // A broken column of light on the water under the sun or the moon.
    const orb=!this.lake?undefined:this.sun.body.visible?this.sun.body:this.moon.body.visible?this.moon.body:undefined
    if(orb){
      const strength=orb===this.sun.body?.5:.35*sky.stars
      for(let i=0,y=212;y<292;i++,y+=8){
        const w=(6+((i*5+Math.max(0,frame))%4)*4)*(1+(y-212)/80)
        fx.fillStyle(sky.glow,strength*(1-(y-212)/110)).fillRect(Math.round((orb.x-w/2)/PX)*PX,y,Math.round(w/PX)*PX,PX)
      }
    }
    if(sky.fog>.05)for(const [y,offset] of [[226,0],[244,80],[262,150]] as const){
      const drift=motion?(Math.max(0,frame)*PX/2)%220:0
      for(let x=left-220+offset+drift;x<left+width;x+=220)fx.fillStyle(0xffffff,sky.fog*.28).fillRect(Math.round(x/PX)*PX,y,120,PX*3).fillStyle(0xffffff,sky.fog*.16).fillRect(Math.round(x/PX)*PX+16,y-PX*2,80,PX*2)
    }
  }
  setReducedMotion(){this.fxFrame=-2;this.smokeKey=-2;this.rainFrame=-2}
  // Rain over the deck and the view (see drawRain), at about eleven frames a second; a still frame with reduced motion.
  private updateRain(motion:boolean){
    const frame=!this.opts.rainy()?-3:motion?Math.floor(this.scene.time.now/90):-1
    if(frame===this.rainFrame)return
    this.rainFrame=frame
    if(frame===-3){this.rainFx.clear();return}
    drawRain(this.rainFx,{x:DECK_LEFT,y:0,width:deck.VIEW_ART_W*PX-(DECK_LEFT-deck.VIEW_LEFT),height:VIEW_H},RAIL_Y,frame)
  }
  // The volcano's plume (see volcanoSmoke): pixel puffs rising from the crater, growing, drifting with the wind and
  // fading, in the sky's colours. Five frames a second; a still plume with reduced motion.
  private updateSmoke(motion:boolean){
    const g=this.smokeGfx,strength=this.lake?volcanoSmoke(Date.now()):0,frame=strength<=0?-3:motion?Math.floor(this.scene.time.now/200):-1
    const key=frame===-3?-3:frame*100+Math.round(strength*20)
    if(key===this.smokeKey)return
    this.smokeKey=key;g.clear()
    if(frame===-3)return
    const sky=this.sky,night=sky.dark>.3,color=night?mixColor(sky.mid,0xffffff,.45):mixColor(0xfafafa,sky.horizon,.2)
    const snap=(value:number)=>Math.round(value/PX)*PX,cycle=8000,clock=motion?this.scene.time.now:2600
    for(let i=0;i<9;i++){
      const p=((clock+i*cycle/9)%cycle)/cycle,r=snap(4+p*13),x=snap(CRATER.x+p*p*40+Math.sin(p*5+i)*3),y=snap(CRATER.y-p*100)
      g.fillStyle(color,strength*(night?.5:.8)*(p<.1?p/.1:1-(p-.1)/.9))
      for(let dy=-r;dy<=r;dy+=PX){const half=snap(Math.sqrt(Math.max(0,r*r-dy*dy)));if(half)g.fillRect(x-half,y+dy,half*2,PX)}
    }
  }
}
