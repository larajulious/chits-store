import Phaser from 'phaser'
import {avatarOptions,type AvatarId} from '../shared/avatars'
import {isHeldDrink,type CafeAction,type HeldDrink} from '../shared/cafe'
import {scenes} from '../shared/world'
import * as art from './pixelArt'
import * as ride from './jeepneyArt'
import {sittingVisitorArt,glowArt} from './neighborhoodArt'
import {HeldDrinks,createDrinkTextures} from './heldDrink'
import {PaintedTexture} from './tanawView'
import {manilaMinute,mixColor,moonArc,skyAt,sunArc,type Sky} from './scenery'
import {BUBBLE_GAP,FADE_COLOR,FADE_MS,FONT,MIN_VIEW_W,NAME_TAG_GAP,PX,TAG_FONT,Tag,addTexture,characterPhase,createReactionTextures,reactionTexture,setDepthIfChanged,tagDepth,type Player,type WorldGame} from './common'

// Riding a jeepney: everyone aboard sits on its long bench while the countryside rolls past the open windows (far
// mountains, rice paddies and the sea, palms and nipa huts close by), in the colours of the time of day. Nobody walks
// here; the page's "Para po!" gets the visitor off, in front of the store.
export type JeepneyGame=WorldGame
type Options={nickname:string;avatar:AvatarId;onAct:(action:CafeAction)=>void;reducedMotion?:boolean;zoom?:number;arriving?:boolean;skyMinute?:number;viewWidth?:number}
type Rider={sprite:Phaser.GameObjects.Image;label:Tag;avatar:string;phase:number;bubble?:Tag|Phaser.GameObjects.Image}

const {width:W,height:H}=scenes.jeepney
// Riders sit on the bench (their network spot) and are drawn up onto it.
const SEAT_LIFT=22
// Scenery bands (world y) and how fast each scrolls past (world units a second): the nearer, the faster.
const SKY_BOTTOM=262,LAYERS={ridge:{y:250,speed:6},fields:{y:318,speed:28},roadside:{y:330,speed:120},road:{y:420,speed:240}}
// Each scenery tile is 256 art pixels wide.
const TILE=256*PX
// Wide screens see past the cab's ends: the scenery runs on either side.
const SIDE=900
const DRIVER_LINES=['Bayad po, salamat!','Kapit lang, may lubak!','Ang ganda ng tanawin, no?','Saan po kayo bababa?','Sabihin lang ang "Para po!"','Sarap ng hangin, ano?','Isa pang sakay, aalis na!']
const pick=<T>(lines:readonly T[])=>lines[Math.floor(Math.random()*lines.length)]!

class JeepneyScene extends Phaser.Scene{
  private opts:Options
  private zoom:number
  private self?:Rider
  private selfId=''
  private remotes=new Map<string,Rider>()
  private drinks?:HeldDrinks
  private sky:Sky=skyAt(0)
  private skyKey=''
  private skyGfx?:Phaser.GameObjects.Graphics
  private grass?:Phaser.GameObjects.Graphics
  private orb?:{body:Phaser.GameObjects.Image;glow:Phaser.GameObjects.Image}
  private painted:{texture:PaintedTexture;color:(sky:Sky)=>number}[]=[]
  // Each scenery layer is a row of copies of its tile, side by side, sliding left together and wrapping round.
  private layers:{images:Phaser.GameObjects.Image[];speed:number;offset:number}[]=[]
  private driver?:Phaser.GameObjects.Image
  private driverBubble?:Tag
  private nextLineAt=0
  private bumpUntil=0
  private nextBumpAt=0
  // The camera's scroll when centred on the cab (it depends on the zoom); a bump nudges it a pixel from there.
  private restScrollY=0
  constructor(opts:Options){super('Jeepney');this.opts=opts;this.zoom=opts.zoom??1}
  private sprite(x:number,y:number,name:string,depth:number){return this.add.image(x,y,name).setScale(PX).setDepth(depth)}
  private text(x:number,y:number,value:string,size:number,color:string,depth:number){
    return this.add.text(x,y,value,{fontFamily:FONT,fontSize:`${size}px`,color,resolution:this.zoom}).setOrigin(.5).setDepth(depth)
  }
  private tag(x:number,y:number,value:string,size=TAG_FONT,wrap?:number){return new Tag(this,x,y,value,{size,wrap,resolution:this.zoom})}
  create(){
    const camera=this.cameras.main
    camera.setZoom(this.zoom).setBackgroundColor('#3b3d44')
    this.createTextures()
    // Behind the cab: the sky, then the scrolling scenery, back to front.
    this.skyGfx=this.add.graphics().setDepth(.1)
    // Low enough over the far mountains to show through the second window.
    this.orb={glow:this.sprite(128,182,'ride-glow',.15).setBlendMode(Phaser.BlendModes.ADD),body:this.sprite(128,182,'ride-sun',.16)}
    // Enough copies of each tile (drawn against its bottom edge, see jeepneyArt.ts) to cover the widest view plus one.
    const row=(key:string,bottom:number,depth:number)=>Array.from({length:Math.ceil((W+SIDE*2)/TILE)+1},(_,i)=>this.add.image(-SIDE+i*TILE,bottom,key).setOrigin(0,1).setScale(PX).setDepth(depth))
    this.layers=(Object.keys(LAYERS) as (keyof typeof LAYERS)[]).map((name,i)=>({images:row(`ride-${name}`,LAYERS[name].y,.3+i*.1),speed:LAYERS[name].speed,offset:0}))
    this.grass=this.add.graphics().setDepth(.55)
    // The cab, its signs and the driver; a dark edge where it ends.
    this.add.image(0,0,'ride-cab').setOrigin(0).setScale(PX).setDepth(1)
    this.add.graphics().setDepth(1).fillStyle(0x2b2430).fillRect(-PX*2,0,PX*2,H).fillRect(W,0,PX*2,H)
    this.text(180,61,'CHITS STORE - TANAW',9,'#a8432f',2)
    this.text(52,103,'PARA PO',7,'#7a2a24',2);this.text(236,103,'BAYAD PO',7,'#2f5f50',2)
    this.driver=this.sprite(336,422,'ride-driver',3).setOrigin(.5,1)
    this.applySky()
    this.time.addEvent({delay:30_000,loop:true,callback:()=>this.applySky()})
    this.nextLineAt=this.time.now+(this.opts.arriving?1200:6000)
    this.nextBumpAt=this.time.now+2500
    const avatar=this.textures.exists(this.opts.avatar)?this.opts.avatar:'mochi'
    this.self=this.rider(scenes.jeepney.spawn.x,scenes.jeepney.spawn.y,avatar,this.opts.nickname,characterPhase(this.opts.nickname))
    this.drinks=new HeldDrinks(this,[],()=>Boolean(this.opts.reducedMotion))
    this.fitCamera(this.opts.viewWidth??MIN_VIEW_W)
    if(this.opts.arriving&&!this.opts.reducedMotion)camera.fadeIn(FADE_MS,...FADE_COLOR)
  }
  private createTextures(){
    const texture=(name:string,pixels:art.PixelArt)=>addTexture(this,name,pixels)
    for(const option of avatarOptions){
      const id=option.id
      texture(id,art.visitorArt(id,'idle'));texture(`${id}-sit`,sittingVisitorArt(id));texture(`${id}-sit-blink`,sittingVisitorArt(id,true))
    }
    texture('ride-cab',ride.interiorArt());texture('ride-driver',ride.driverArt())
    texture('ride-sun',new art.PixelArt(14,14).ellipse(7,7,6.5,6.5,'#fff6dc').ellipse(7,7,5,5,'#ffffff'))
    texture('ride-glow',glowArt(18,'#ffffff'))
    // The scenery is painted for the time of day: the mountains in the sky's own blue, the rest darkened after dark.
    const dusk=(sky:Sky)=>mixColor(mixColor(0xffffff,sky.glow,sky.warmth*.35),0x3a4570,Math.min(.75,sky.dark*1.3))
    const paint=(key:string,pixels:art.PixelArt,color:(sky:Sky)=>number)=>this.painted.push({texture:new PaintedTexture(this,key,pixels),color})
    paint('ride-ridge',ride.rideRidgeArt(),sky=>sky.far);paint('ride-fields',ride.rideFieldsArt(),dusk)
    paint('ride-roadside',ride.rideRoadsideArt(),dusk);paint('ride-road',ride.rideRoadArt(),dusk)
    createReactionTextures(this);createDrinkTextures(this)
  }
  private applySky(){
    const minute=this.opts.skyMinute??manilaMinute(),sky=skyAt(minute),sunAt=sunArc(minute),moonAt=moonArc(minute)
    const key=JSON.stringify([sky,sunAt===undefined,moonAt===undefined])
    if(key===this.skyKey)return
    this.skyKey=key;this.sky=sky
    const g=this.skyGfx!
    g.clear()
    for(let i=0;i<15;i++){const t=i/14;g.fillStyle(t<.6?mixColor(sky.top,sky.mid,t/.6):mixColor(sky.mid,sky.horizon,(t-.6)/.4)).fillRect(-SIDE,i*SKY_BOTTOM/15,W+SIDE*2,SKY_BOTTOM/15+1)}
    for(let i=0;i<24&&sky.stars>0;i++)g.fillStyle(0xfff6dc,sky.stars*(i<5?1:.6)).fillRect(-SIDE+((i*173)%(W+SIDE*2)),Math.round((10+(i*53)%150)/PX)*PX,PX,PX)
    for(const {texture,color} of this.painted)texture.paint(color(sky))
    this.grass?.clear().fillStyle(mixColor(0x4f7d4a,0x1a2a2a,Math.min(.8,sky.dark*1.4))).fillRect(-SIDE,LAYERS.road.y,W+SIDE*2,H-LAYERS.road.y)
    // A sun by day, the moon by night, hanging still over the far mountains as the jeepney rolls on.
    const orb=this.orb!,up=sunAt!==undefined||moonAt!==undefined
    orb.body.setVisible(up).setTint(sunAt!==undefined?mixColor(0xffffff,sky.glow,.4):0xf6f1de);orb.glow.setVisible(up).setTint(sky.glow).setAlpha(.7)
  }
  private rider(x:number,y:number,avatar:string,name:string,phase:number):Rider{
    const sprite=this.sprite(x,y,`${avatar}-sit`,y+10)
    sprite.setOrigin(.5,.5+SEAT_LIFT/sprite.displayHeight)
    return {sprite,label:this.tag(x,y-SEAT_LIFT-NAME_TAG_GAP,name).setDepth(tagDepth(y)),avatar,phase}
  }
  // The ride: scenery scrolling past, a bump now and then that jolts everyone a pixel, blinking riders, the driver's chatter.
  override update(_:number,delta:number){
    const now=this.time.now,motion=!this.opts.reducedMotion,step=Math.min(delta,100)/1000
    if(motion)for(const layer of this.layers){
      layer.offset=(layer.offset+layer.speed*step)%TILE
      const shift=Math.round(layer.offset/PX)*PX
      layer.images.forEach((image,i)=>{const x=-SIDE+i*TILE-shift;if(image.x!==x)image.x=x})
    }
    if(motion&&now>=this.nextBumpAt){this.bumpUntil=now+160;this.nextBumpAt=now+1800+Math.random()*2600}
    const camera=this.cameras.main,scrollY=this.restScrollY+(now<this.bumpUntil?-PX:0)
    if(camera.scrollY!==scrollY)camera.setScroll(camera.scrollX,scrollY)
    for(const rider of [this.self,...this.remotes.values()]){
      if(!rider)continue
      const texture=`${rider.avatar}-sit${motion&&(now+rider.phase)%4300<130?'-blink':''}`
      if(this.textures.exists(texture)&&rider.sprite.texture.key!==texture)rider.sprite.setTexture(texture)
    }
    this.drinks?.update()
    if(now>=this.nextLineAt&&this.driver){
      this.nextLineAt=now+16_000+Math.random()*14_000
      this.driverBubble?.destroy()
      const bubble=this.tag(this.driver.x-30,this.driver.y-this.driver.displayHeight-8,pick(DRIVER_LINES),TAG_FONT,140).setDepth(900)
      this.driverBubble=bubble
      this.time.delayedCall(3600,()=>{if(this.driverBubble===bubble)this.driverBubble=undefined;bubble.destroy()})
    }
  }
  // The cab stays centred; wider screens see the scenery carry on past both ends.
  private fitCamera(width:number){this.cameras.main.setSize(width*this.zoom,H*this.zoom).centerOn(W/2,H/2);this.restScrollY=this.cameras.main.scrollY}
  setViewWidth(width:number){
    if(!this.sys?.isActive())return
    this.scale.setGameSize(width*this.zoom,H*this.zoom)
    this.fitCamera(width)
  }
  setReducedMotion(value:boolean){this.opts.reducedMotion=value}
  setPlayers(players:Player[],selfId:string){
    this.selfId=selfId
    const own=players.find(p=>p.id===selfId)
    if(own&&this.self)this.placeRider(this.self,own.x,own.y,own.nickname)
    const incoming=new Set(players.filter(p=>p.id!==selfId).map(p=>p.id))
    for(const [id,rider] of this.remotes)if(!incoming.has(id)){this.drinks?.remove(rider.sprite);rider.sprite.destroy();rider.label.destroy();rider.bubble?.destroy();this.remotes.delete(id)}
    for(const p of players){
      if(p.id===selfId)continue
      let rider=this.remotes.get(p.id)
      if(!rider){const avatar=this.textures.exists(p.avatar)?p.avatar:'mochi';rider=this.rider(p.x,p.y,avatar,p.nickname,characterPhase(p.id));this.remotes.set(p.id,rider)}
      this.placeRider(rider,p.x,p.y,p.nickname)
    }
    for(const p of players){const rider=p.id===selfId?this.self:this.remotes.get(p.id);if(rider)this.drinks?.set(rider.sprite,isHeldDrink(p.drink)?p.drink:null)}
  }
  private placeRider(rider:Rider,x:number,y:number,name:string){
    rider.sprite.setPosition(x,y);setDepthIfChanged(rider.sprite,y+10)
    rider.label.setPosition(x,y-SEAT_LIFT-NAME_TAG_GAP);setDepthIfChanged(rider.label,tagDepth(y))
    if(rider.label.text!==name)rider.label.setText(name)
    if(rider.bubble instanceof Tag)rider.bubble.setPosition(x,y-SEAT_LIFT-BUBBLE_GAP)
  }
  // Riders stay in their seats.
  movePlayer(id:string,x:number,y:number){const rider=this.remotes.get(id);if(rider)this.placeRider(rider,x,y,rider.label.text)}
  showBubble(id:string,text:string){
    const rider=id===this.selfId?this.self:this.remotes.get(id)
    if(!rider)return
    const {sprite}=rider,reaction=reactionTexture(text),top=sprite.y-SEAT_LIFT
    rider.bubble?.destroy()
    const bubble=reaction?this.sprite(sprite.x,top-BUBBLE_GAP-20,reaction,900):this.tag(sprite.x,top-BUBBLE_GAP,text.slice(0,32),TAG_FONT,140).setDepth(900)
    rider.bubble=bubble
    this.time.delayedCall(3500,()=>{if(rider.bubble===bubble)rider.bubble=undefined;bubble.destroy()})
  }
  setDrink(id:string,drink:HeldDrink|null){const rider=id===this.selfId?this.self:this.remotes.get(id);if(rider)this.drinks?.set(rider.sprite,drink)}
  playAction(id:string,action:CafeAction){const rider=this.remotes.get(id);if(rider&&action==='sip')this.drinks?.sip(rider.sprite)}
  sip(){if(!this.self||!this.drinks?.sip(this.self.sprite))return false;this.opts.onAct('sip');return true}
  // Getting off: the screen fades while the server moves the visitor to the street.
  exitScene(){
    return new Promise<void>(resolve=>{
      if(this.opts.reducedMotion){resolve();return}
      this.cameras.main.fade(FADE_MS,...FADE_COLOR,true,(_:unknown,progress:number)=>{if(progress>=1)resolve()})
    })
  }
  cancelExit(){if(this.opts.reducedMotion)this.cameras.main.resetFX();else this.cameras.main.fadeEffect.start(false,FADE_MS,...FADE_COLOR,true)}
}

export function createJeepney(el:HTMLElement,opts:Options):JeepneyGame{
  const zoom=Math.max(1,Math.min(4,Math.round(opts.zoom??1))),viewW=opts.viewWidth??MIN_VIEW_W
  const scene=new JeepneyScene({...opts,zoom})
  const game=new Phaser.Game({type:Phaser.AUTO,parent:el,width:viewW*zoom,height:H*zoom,backgroundColor:'#3b3d44',pixelArt:true,
    scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_HORIZONTALLY,width:viewW*zoom,height:H*zoom},scene:[scene],render:{antialias:false}})
  const active=()=>Boolean(scene.sys?.isActive())
  return {game,setDirection:()=>{},setPlayers:(players,id)=>{if(active())scene.setPlayers(players,id)},movePlayer:(id,x,y)=>{if(active())scene.movePlayer(id,x,y)},
    showBubble:(id,text)=>{if(active())scene.showBubble(id,text)},setReducedMotion:value=>{if(active())scene.setReducedMotion(value)},setControlsEnabled:()=>{},
    exitScene:()=>active()?scene.exitScene():Promise.resolve(),cancelExit:()=>{if(active())scene.cancelExit()},setViewWidth:width=>scene.setViewWidth(width),
    setDrink:(id,drink)=>{if(active())scene.setDrink(id,drink)},playAction:(id,action)=>{if(active())scene.playAction(id,action)},sip:()=>active()&&scene.sip()}
}
