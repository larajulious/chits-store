import Phaser from 'phaser'
import {avatarOptions,type AvatarId} from '../shared/avatars'
import {isHeldDrink,type CafeAction,type HeldDrink} from '../shared/cafe'
import {scenes} from '../shared/world'
import * as art from './pixelArt'
import * as ride from './jeepneyArt'
import {cloudArt} from './deckArt'
import {glowArt,sittingVisitorArt,vehicleArt} from './neighborhoodArt'
import {HeldDrinks,createDrinkTextures} from './heldDrink'
import {PaintedTexture} from './tanawView'
import {manilaMinute,mixColor,moonArc,skyAt,sunArc,type Sky} from './scenery'
import {BUBBLE_GAP,FADE_COLOR,FADE_MS,FONT,MIN_VIEW_W,NAME_TAG_GAP,PX,TAG_FONT,Tag,addTexture,characterPhase,createReactionTextures,reactionTexture,type Player,type WorldGame} from './common'

// Riding a jeepney: the jeepney seen big from the side, rolling along a country road, everyone aboard at its open
// windows. The world scrolls past it in layers (far mountains, rice paddies and the sea, palms and nipa huts and a
// carabao, the road with oncoming traffic, the verge rushing by in front), coloured for the time of day. Nobody walks
// here; the page's "Para po!" gets the visitor off, in front of the store.
export type JeepneyGame=WorldGame
type Options={nickname:string;avatar:AvatarId;onAct:(action:CafeAction)=>void;reducedMotion?:boolean;zoom?:number;arriving?:boolean;skyMinute?:number;viewWidth?:number}
type Rider={sprite:Phaser.GameObjects.Image;label:Tag;avatar:string;phase:number;seat:number;bubble?:Tag|Phaser.GameObjects.Image}

const {width:W,height:H}=scenes.jeepney
// The jeepney fills the scene's width, its wheels on the near lane. Riders' heads and shoulders show in its windows;
// their name tags sit above the roof, alternately high and low so neighbours' tags don't overlap.
const JEEP_BOTTOM=466,JEEP_TOP=JEEP_BOTTOM-ride.JEEP.height*PX,RIDER_Y=JEEP_TOP+56
const TAG_Y=[JEEP_TOP-6,JEEP_TOP-24]
const DEPTH={sky:.1,orb:.15,cloud:.2,ridge:.3,fields:.4,roadside:.5,road:.6,oncoming:.7,exhaust:.9,interior:1,rider:2,body:3,wheel:3.1,text:3.2,verge:4,light:5}
// Scenery layers (bottom edge in world y) and how fast each scrolls past (world units a second): nearer is faster.
const LAYERS={ridge:{y:250,speed:6},fields:{y:300,speed:26},roadside:{y:360,speed:110},road:{y:480,speed:230},verge:{y:H,speed:300}}
const TILE=256*PX,SIDE=900,SKY_BOTTOM=262
const DRIVER_LINES=['Bayad po, salamat!','Kapit lang, may lubak!','Ang ganda ng tanawin, no?','Saan po kayo bababa?','Sabihin lang ang "Para po!"','Sarap ng hangin, ano?','Uy, may kalabaw!']
const pick=<T>(lines:readonly T[])=>lines[Math.floor(Math.random()*lines.length)]!
// A colour multiplied by another, like the painted scenery (for the plain ground strip under the roadside).
const multiply=(a:number,b:number)=>[16,8,0].reduce((out,shift)=>out|Math.round(((a>>shift)&255)*((b>>shift)&255)/255)<<shift,0)
// The time of day's colour for the near scenery: warmed at sunset, dimmed toward blue at night.
const dusk=(sky:Sky)=>mixColor(mixColor(0xffffff,sky.glow,sky.warmth*.35),0x3a4570,Math.min(.72,sky.dark*1.3))
const snap=(value:number)=>Math.round(value/PX)*PX

class JeepneyScene extends Phaser.Scene{
  private opts:Options
  private zoom:number
  private self?:Rider
  private selfId=''
  private remotes=new Map<string,Rider>()
  private drinks?:HeldDrinks
  private skyKey=''
  private night=false
  private skyGfx?:Phaser.GameObjects.Graphics
  private ground?:Phaser.GameObjects.Graphics
  private orb?:{body:Phaser.GameObjects.Image;glow:Phaser.GameObjects.Image}
  private clouds:Phaser.GameObjects.Image[]=[]
  private painted:{texture:PaintedTexture;color:(sky:Sky)=>number}[]=[]
  private layers:{images:Phaser.GameObjects.Image[];speed:number;offset:number}[]=[]
  // The jeepney's parts, each with the y it rests at: a bump lifts them all a pixel.
  private jeep:{object:Phaser.GameObjects.Image|Phaser.GameObjects.Text;y:number}[]=[]
  private interior?:Phaser.GameObjects.Image
  private body?:Phaser.GameObjects.Image
  private wheels:Phaser.GameObjects.Image[]=[]
  private headlight?:Phaser.GameObjects.Image
  private exhaust?:Phaser.GameObjects.Graphics
  private oncoming?:{image:Phaser.GameObjects.Image;x:number;speed:number}
  private nextOncomingAt=0
  private driverBubble?:Tag
  private nextLineAt=0
  private bumpUntil=0
  private nextBumpAt=0
  constructor(opts:Options){super('Jeepney');this.opts=opts;this.zoom=opts.zoom??1}
  private sprite(x:number,y:number,name:string,depth:number){return this.add.image(x,y,name).setScale(PX).setDepth(depth)}
  private tag(x:number,y:number,value:string,size=TAG_FONT,wrap?:number){return new Tag(this,x,y,value,{size,wrap,resolution:this.zoom})}
  create(){
    const camera=this.cameras.main
    camera.setZoom(this.zoom).setBackgroundColor('#5e9fe0')
    this.createTextures()
    // The sky, the sun or moon, clouds, then the scenery rows from the far mountains to the verge in front.
    this.skyGfx=this.add.graphics().setDepth(DEPTH.sky)
    this.orb={glow:this.sprite(292,92,'ride-glow',DEPTH.orb).setBlendMode(Phaser.BlendModes.ADD),body:this.sprite(292,92,'ride-sun',DEPTH.orb+.01)}
    this.clouds=[[-260,46],[120,88],[520,58],[860,100]].map(([x,y])=>this.sprite(x!,y!,'ride-cloud',DEPTH.cloud))
    const row=(key:string,bottom:number,depth:number)=>Array.from({length:Math.ceil((W+SIDE*2)/TILE)+1},(_,i)=>this.add.image(-SIDE+i*TILE,bottom,key).setOrigin(0,1).setScale(PX).setDepth(depth))
    this.layers=(Object.keys(LAYERS) as (keyof typeof LAYERS)[]).map(name=>({images:row(`ride-${name}`,LAYERS[name].y,DEPTH[name]),speed:LAYERS[name].speed,offset:0}))
    // Fields' ground behind the roadside, so no sky shows between the paddies and the palms.
    this.ground=this.add.graphics().setDepth(DEPTH.fields-.01)
    // The jeepney: cab behind the riders, body in front, wheels, its lettering; exhaust behind and a headlight ahead.
    const part=<T extends Phaser.GameObjects.Image|Phaser.GameObjects.Text>(object:T)=>{this.jeep.push({object,y:object.y});return object}
    this.interior=part(this.add.image(0,JEEP_TOP,'ride-interior-day').setOrigin(0).setScale(PX).setDepth(DEPTH.interior))
    this.body=part(this.add.image(0,JEEP_TOP,'ride-body-day').setOrigin(0).setScale(PX).setDepth(DEPTH.body))
    this.wheels=ride.JEEP.wheels.map(x=>part(this.sprite(x*PX,JEEP_TOP+ride.JEEP.wheelY*PX,'ride-wheel-0',DEPTH.wheel)))
    const lettering=(x:number,y:number,value:string,color:string)=>part(this.add.text(x,y,value,{fontFamily:FONT,fontSize:'8px',color,resolution:this.zoom}).setOrigin(.5).setDepth(DEPTH.text))
    lettering(238,JEEP_TOP+7,'CHITS - TANAW','#c8553d');lettering(154,JEEP_TOP+85,'CHITS EXPRESS','#a8432f')
    this.exhaust=this.add.graphics().setDepth(DEPTH.exhaust)
    // The headlight's pool lies flat on the road ahead of the jeepney.
    this.headlight=this.add.image(W+60,JEEP_BOTTOM-8,'ride-beam').setScale(PX).setDepth(DEPTH.light).setBlendMode(Phaser.BlendModes.ADD).setVisible(false)
    this.applySky()
    this.time.addEvent({delay:30_000,loop:true,callback:()=>this.applySky()})
    const now=this.time.now
    this.nextLineAt=now+(this.opts.arriving?1400:6000);this.nextBumpAt=now+2500;this.nextOncomingAt=now+3500
    const avatar=this.textures.exists(this.opts.avatar)?this.opts.avatar:'mochi'
    this.self=this.rider(0,avatar,this.opts.nickname,characterPhase(this.opts.nickname))
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
    for(const night of [false,true]){const time=night?'night':'day';texture(`ride-interior-${time}`,ride.interiorArt(night));texture(`ride-body-${time}`,ride.bodyArt(night))}
    for(const frame of [0,1,2,3] as const)texture(`ride-wheel-${frame}`,ride.wheelArt(frame))
    for(const kind of ['car','tricycle'] as const)for(let paint=0;paint<4;paint++)texture(`oncoming-${kind}-${paint}`,vehicleArt(kind,paint,0))
    texture('ride-sun',new art.PixelArt(16,16).ellipse(8,8,7.5,7.5,'#fff6dc').ellipse(8,8,6,6,'#ffffff'))
    texture('ride-moon',new art.PixelArt(14,14).ellipse(7,7,6.5,6.5,'#f6f1de').set(5,5,'#ddd5bb').set(8,8,'#ddd5bb').set(9,4,'#ddd5bb').set(4,8,'#ddd5bb'))
    texture('ride-glow',glowArt(22,'#ffffff'));texture('ride-beam',new art.PixelArt(64,14).ellipse(32,7,31.5,6.5,'#ffd97a50').ellipse(26,7,22,4.6,'#ffe9a870').ellipse(18,7,12,3,'#fff3c490'))
    // Scenery painted for the time of day: mountains in the sky's own blue, the rest warmed at sunset and dimmed at night.
    const paint=(key:string,pixels:art.PixelArt,color:(sky:Sky)=>number)=>this.painted.push({texture:new PaintedTexture(this,key,pixels),color})
    paint('ride-ridge',ride.rideRidgeArt(),sky=>sky.far);paint('ride-fields',ride.rideFieldsArt(),dusk);paint('ride-roadside',ride.rideRoadsideArt(),dusk)
    paint('ride-road',ride.rideRoadArt(),dusk);paint('ride-verge',ride.rideVergeArt(),dusk)
    paint('ride-cloud',cloudArt(),sky=>sky.dark>.3?mixColor(sky.mid,0xffffff,.3):mixColor(0xffffff,sky.horizon,.25))
    createReactionTextures(this);createDrinkTextures(this)
  }
  private applySky(){
    const minute=this.opts.skyMinute??manilaMinute(),sky=skyAt(minute),sunAt=sunArc(minute),moonAt=moonArc(minute)
    const key=JSON.stringify([sky,sunAt===undefined,moonAt===undefined])
    if(key===this.skyKey)return
    this.skyKey=key;this.night=sky.dark>.3
    const g=this.skyGfx!
    g.clear()
    for(let i=0;i<15;i++){const t=i/14;g.fillStyle(t<.6?mixColor(sky.top,sky.mid,t/.6):mixColor(sky.mid,sky.horizon,(t-.6)/.4)).fillRect(-SIDE,i*SKY_BOTTOM/15,W+SIDE*2,SKY_BOTTOM/15+1)}
    for(let i=0;i<30&&sky.stars>0;i++)g.fillStyle(0xfff6dc,sky.stars*(i<6?1:.6)).fillRect(snap(-SIDE+(i*173)%(W+SIDE*2)),snap(8+(i*53)%150),i<6?PX:PX/2,i<6?PX:PX/2)
    this.cameras.main.setBackgroundColor(sky.horizon)
    for(const {texture,color} of this.painted)texture.paint(color(sky))
    this.ground?.clear().fillStyle(multiply(0x8fbf6a,dusk(sky))).fillRect(-SIDE,LAYERS.fields.y-4,W+SIDE*2,LAYERS.roadside.y-LAYERS.fields.y)
    for(const cloud of this.clouds)cloud.setAlpha(1-sky.dark*.55)
    // The sun by day, the moon by night, hanging still above the mountains as the jeepney rolls on.
    const orb=this.orb!,sun=sunAt!==undefined,up=sun||moonAt!==undefined
    orb.body.setTexture(sun?'ride-sun':'ride-moon').setVisible(up);orb.glow.setVisible(up).setAlpha(sun?.9:.5*sky.stars+.2)
    // After dark: the cab glows, the roof lamps come on, and the headlight lights the road ahead.
    const time=this.night?'night':'day'
    this.interior?.setTexture(`ride-interior-${time}`);this.body?.setTexture(`ride-body-${time}`)
    this.headlight?.setVisible(sky.lights>.05).setAlpha(sky.lights)
  }
  private rider(seat:number,avatar:string,name:string,phase:number):Rider{
    const sprite=this.sprite(0,RIDER_Y,`${avatar}-sit`,DEPTH.rider)
    const rider={sprite,label:this.tag(0,TAG_Y[0]!,name).setDepth(900),avatar,phase,seat:-1}
    this.seatRider(rider,seat)
    return rider
  }
  // A rider at window `seat`: head and shoulders in the opening, name tag above the roof.
  private seatRider(rider:Rider,seat:number){
    if(rider.seat===seat)return
    rider.seat=seat
    const x=(ride.windowX(seat)+ride.JEEP.windowW/2)*PX
    rider.sprite.setPosition(x,RIDER_Y);rider.label.setPosition(x,TAG_Y[seat%2]!)
  }
  // The ride: scenery and clouds scrolling past, wheels turning, a puff of exhaust, a bump now and then, oncoming
  // traffic, blinking riders, the driver's chatter.
  override update(_:number,delta:number){
    const now=this.time.now,motion=!this.opts.reducedMotion,step=Math.min(delta,100)/1000
    if(motion){
      for(const layer of this.layers){
        layer.offset=(layer.offset+layer.speed*step)%TILE
        const shift=snap(layer.offset)
        layer.images.forEach((image,i)=>{const x=-SIDE+i*TILE-shift;if(image.x!==x)image.x=x})
      }
      for(const cloud of this.clouds){const x=cloud.x-step*8;cloud.x=x<-SIDE-60?W+SIDE+60:x}
      const frame=Math.floor(now/70)%4
      for(const wheel of this.wheels)if(wheel.texture.key!==`ride-wheel-${frame}`)wheel.setTexture(`ride-wheel-${frame}`)
      if(now>=this.nextBumpAt){this.bumpUntil=now+150;this.nextBumpAt=now+1600+Math.random()*2400}
      this.updateOncoming(now,step)
    }
    // A bump lifts the jeepney and everyone aboard a pixel; riders' cups follow their sprites.
    const lift=now<this.bumpUntil?-PX:0
    for(const {object,y} of this.jeep)if(object.y!==y+lift)object.y=y+lift
    for(const rider of [this.self,...this.remotes.values()]){
      if(!rider)continue
      if(rider.sprite.y!==RIDER_Y+lift)rider.sprite.y=RIDER_Y+lift
      const texture=`${rider.avatar}-sit${motion&&(now+rider.phase)%4300<130?'-blink':''}`
      if(this.textures.exists(texture)&&rider.sprite.texture.key!==texture)rider.sprite.setTexture(texture)
    }
    this.drinks?.update()
    this.drawExhaust(now,motion)
    if(now>=this.nextLineAt){
      this.nextLineAt=now+15_000+Math.random()*14_000
      this.driverBubble?.destroy()
      const bubble=this.tag(300,JEEP_TOP-44,pick(DRIVER_LINES),TAG_FONT,140).setDepth(901)
      this.driverBubble=bubble
      this.time.delayedCall(3600,()=>{if(this.driverBubble===bubble)this.driverBubble=undefined;bubble.destroy()})
    }
  }
  // Now and then a car or a tricycle comes the other way in the far lane.
  private updateOncoming(now:number,step:number){
    const car=this.oncoming
    if(car){
      car.x-=car.speed*step
      car.image.x=snap(car.x)
      if(car.x<-SIDE-120){car.image.destroy();this.oncoming=undefined;this.nextOncomingAt=now+5000+Math.random()*9000}
      return
    }
    if(now<this.nextOncomingAt)return
    const kind=Math.random()<.6?'car':'tricycle',x=W+SIDE+120
    this.oncoming={image:this.add.image(x,412,`oncoming-${kind}-${Math.floor(Math.random()*4)}`).setOrigin(.5,1).setScale(PX).setFlipX(true).setDepth(DEPTH.oncoming),x,speed:480+Math.random()*120}
  }
  // A few soft puffs from the back of the jeepney, drifting away and fading.
  private drawExhaust(now:number,motion:boolean){
    const g=this.exhaust
    if(!g)return
    g.clear()
    if(!motion)return
    for(let i=0;i<4;i++){
      const p=((now+i*450)%1800)/1800,r=snap(3+p*8),x=snap(-4-p*70),y=snap(JEEP_BOTTOM-26-p*18)
      g.fillStyle(this.night?0x9aa3ab:0xe6e2da,.45*(1-p))
      for(let dy=-r;dy<=r;dy+=PX){const half=snap(Math.sqrt(Math.max(0,r*r-dy*dy)));if(half)g.fillRect(x-half,y+dy,half*2,PX)}
    }
  }
  // The jeepney stays centred; wider screens see the countryside carry on past both ends.
  private fitCamera(width:number){this.cameras.main.setSize(width*this.zoom,H*this.zoom).centerOn(W/2,H/2)}
  setViewWidth(width:number){
    if(!this.sys?.isActive())return
    this.scale.setGameSize(width*this.zoom,H*this.zoom)
    this.fitCamera(width)
  }
  setReducedMotion(value:boolean){this.opts.reducedMotion=value}
  // Each rider's window comes from their network position (the server seats them; see jeepneySeats).
  private seatOf(x:number){return Math.max(0,Math.min(ride.JEEP.windows-1,Math.round((x/PX-ride.JEEP.firstWindow-ride.JEEP.windowW/2)/ride.JEEP.windowGap)))}
  setPlayers(players:Player[],selfId:string){
    this.selfId=selfId
    const own=players.find(p=>p.id===selfId)
    if(own&&this.self){this.seatRider(this.self,this.seatOf(own.x));if(this.self.label.text!==own.nickname)this.self.label.setText(own.nickname)}
    const incoming=new Set(players.filter(p=>p.id!==selfId).map(p=>p.id))
    for(const [id,rider] of this.remotes)if(!incoming.has(id)){this.drinks?.remove(rider.sprite);rider.sprite.destroy();rider.label.destroy();rider.bubble?.destroy();this.remotes.delete(id)}
    for(const p of players){
      if(p.id===selfId)continue
      let rider=this.remotes.get(p.id)
      if(!rider){const avatar=this.textures.exists(p.avatar)?p.avatar:'mochi';rider=this.rider(this.seatOf(p.x),avatar,p.nickname,characterPhase(p.id));this.remotes.set(p.id,rider)}
      this.seatRider(rider,this.seatOf(p.x))
      if(rider.label.text!==p.nickname)rider.label.setText(p.nickname)
    }
    for(const p of players){const rider=p.id===selfId?this.self:this.remotes.get(p.id);if(rider)this.drinks?.set(rider.sprite,isHeldDrink(p.drink)?p.drink:null)}
  }
  // Riders stay at their windows.
  movePlayer(id:string,x:number){const rider=this.remotes.get(id);if(rider)this.seatRider(rider,this.seatOf(x))}
  showBubble(id:string,text:string){
    const rider=id===this.selfId?this.self:this.remotes.get(id)
    if(!rider)return
    const {sprite}=rider,reaction=reactionTexture(text),top=TAG_Y[rider.seat%2]!+NAME_TAG_GAP
    rider.bubble?.destroy()
    const bubble=reaction?this.sprite(sprite.x,top-BUBBLE_GAP-20,reaction,902):this.tag(sprite.x,top-BUBBLE_GAP,text.slice(0,32),TAG_FONT,140).setDepth(902)
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
  const game=new Phaser.Game({type:Phaser.AUTO,parent:el,width:viewW*zoom,height:H*zoom,backgroundColor:'#5e9fe0',pixelArt:true,
    scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_HORIZONTALLY,width:viewW*zoom,height:H*zoom},scene:[scene],render:{antialias:false}})
  const active=()=>Boolean(scene.sys?.isActive())
  return {game,setDirection:()=>{},setPlayers:(players,id)=>{if(active())scene.setPlayers(players,id)},movePlayer:(id,x)=>{if(active())scene.movePlayer(id,x)},
    showBubble:(id,text)=>{if(active())scene.showBubble(id,text)},setReducedMotion:value=>{if(active())scene.setReducedMotion(value)},setControlsEnabled:()=>{},
    exitScene:()=>active()?scene.exitScene():Promise.resolve(),cancelExit:()=>{if(active())scene.cancelExit()},setViewWidth:width=>scene.setViewWidth(width),
    setDrink:(id,drink)=>{if(active())scene.setDrink(id,drink)},playAction:(id,action)=>{if(active())scene.playAction(id,action)},sip:()=>active()&&scene.sip()}
}
