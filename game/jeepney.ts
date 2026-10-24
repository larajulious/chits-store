import Phaser from 'phaser'
import {avatarOptions,type AvatarId} from '../shared/avatars'
import {isHeldDrink,type CafeAction,type HeldDrink} from '../shared/cafe'
import {scenes} from '../shared/world'
import * as art from './pixelArt'
import * as ride from './jeepneyArt'
import {cloudArt} from './deckArt'
import {glowArt,sittingVisitorArt,vehicleArt,type Vehicle} from './neighborhoodArt'
import {HeldDrinks,createDrinkTextures} from './heldDrink'
import {PaintedTexture} from './tanawView'
import {manilaMinute,mixColor,moonArc,skyAt,sunArc,type Sky} from './scenery'
import {BUBBLE_GAP,FADE_COLOR,FADE_MS,FONT,MIN_VIEW_W,NAME_TAG_GAP,PX,TAG_FONT,Tag,addTexture,characterPhase,createReactionTextures,reactionTexture,type Player,type WorldGame} from './common'

// Riding a jeepney: the jeepney seen big from the side, rolling along, everyone aboard at its open windows. The world
// scrolls past it in layers (far mountains, the middle distance, the roadside, the road with oncoming traffic, the verge
// rushing by in front), coloured for the time of day. The trip runs through four places in turn, each with its own
// scenery and a landmark: Taal Lake from Tagaytay, the Lion's Head on Kennon Road, Mayon, then EDSA. Nobody walks
// here; the page's "Para po!" gets the visitor off, in front of the store.
export type JeepneyGame=WorldGame
type Options={nickname:string;avatar:AvatarId;onAct:(action:CafeAction)=>void;reducedMotion?:boolean;zoom?:number;arriving?:boolean;skyMinute?:number;viewWidth?:number}
type Layer=keyof typeof LAYERS
type Landmark={image:Phaser.GameObjects.Image;x:number;speed:number;gap:number;leaving:boolean}
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
const DRIVER_LINES=['Bayad po, salamat!','Kapit lang, may lubak!','Ang ganda ng tanawin, no?','Saan po kayo bababa?','Sabihin lang ang "Para po!"','Sarap ng hangin, ano?']
// Each leg of the trip lasts this long, and the next one's scenery fades in over this long.
const LEG_MS=45_000,CROSSFADE_MS=1600
// The trip, leg by leg (in ride.RIDE_LEGS order): the place's name, the route board, how fast the jeepney can go (EDSA
// crawls), the ground colour behind the roadside, the landmark (where it starts, its bottom edge and depth, how fast it
// drifts with the scenery and on its own, the gap before it comes round again, how much distance haze it takes), the
// oncoming traffic, and the driver's lines (the first is said on arrival).
const LEGS:Record<ride.RideLeg,{place:string;board:string;pace:number;ground:number;landmark:{x:number;y:number;depth:number;drift:number;own:number;gap:number;haze:number};traffic:readonly Vehicle[];lines:readonly string[]}>={
  taal:{place:'Tagaytay · Taal Lake view',board:'TAGAYTAY',pace:1,ground:0x8fbf6a,landmark:{x:250,y:282,depth:.45,drift:4,own:0,gap:120,haze:.3},traffic:['car','tricycle'],
    lines:['Ayan na ang Bulkang Taal!','Bulalo tayo mamaya?','Ang lamig ng hangin sa Tagaytay!','Pasalubong: buko pie!']},
  baguio:{place:"Kennon Road · Lion's Head, Baguio",board:'BAGUIO',pace:.8,ground:0x5f8a52,landmark:{x:280,y:344,depth:.49,drift:24,own:0,gap:260,haze:0},traffic:['car','jeepney'],
    lines:["Ayan ang Lion's Head! Picture tayo!",'Kapit, paakyat ng Kennon!','Strawberry taho, sino gusto?','Ramdam na ang lamig ng Baguio!']},
  mayon:{place:'Albay · Mayon Volcano',board:'LEGAZPI',pace:1,ground:0x8fbf6a,landmark:{x:230,y:256,depth:.35,drift:4,own:0,gap:120,haze:.4},traffic:['car','tricycle'],
    lines:['Ayan na ang Mayon! Perfect cone!','Daragang Magayon, ang ganda!','Bicol Express mamaya?','Uy, may kalabaw!']},
  edsa:{place:'Metro Manila · EDSA',board:'EDSA - CUBAO',pace:.45,ground:0xbdb7ac,landmark:{x:300,y:241,depth:.41,drift:26,own:120,gap:700,haze:0},traffic:['car','jeepney'],
    lines:['EDSA na! Traffic na naman.','Cubao, Cubao! Sakay na!','Ayan ang MRT, siksikan din!','Kapit lang, usad-pagong tayo.']},
}
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
  private sky?:Sky
  private night=false
  private skyGfx?:Phaser.GameObjects.Graphics
  private ground?:Phaser.GameObjects.Graphics
  private orb?:{body:Phaser.GameObjects.Image;glow:Phaser.GameObjects.Image}
  private clouds:Phaser.GameObjects.Image[]=[]
  private painted:{texture:PaintedTexture;color:(sky:Sky)=>number}[]=[]
  // Each layer's rows of tiles: one, or two while the next leg's fades in over the last one's.
  private layers:{name:Layer;rows:Phaser.GameObjects.Image[][];speed:number;offset:number}[]=[]
  private legIndex=0
  private legEndsAt=0
  private landmarks:Landmark[]=[]
  private board?:Phaser.GameObjects.Text
  private placeTag?:Tag
  private introLine=''
  private wheelTurn=0
  private viewW=MIN_VIEW_W
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
    this.layers=(Object.keys(LAYERS) as Layer[]).map(name=>({name,rows:[],speed:LAYERS[name].speed,offset:0}))
    // Fields' ground behind the roadside, so no sky shows between the paddies and the palms.
    this.ground=this.add.graphics().setDepth(DEPTH.fields-.01)
    // The jeepney: cab behind the riders, body in front, wheels, its lettering; exhaust behind and a headlight ahead.
    const part=<T extends Phaser.GameObjects.Image|Phaser.GameObjects.Text>(object:T)=>{this.jeep.push({object,y:object.y});return object}
    this.interior=part(this.add.image(0,JEEP_TOP,'ride-interior-day').setOrigin(0).setScale(PX).setDepth(DEPTH.interior))
    this.body=part(this.add.image(0,JEEP_TOP,'ride-body-day').setOrigin(0).setScale(PX).setDepth(DEPTH.body))
    this.wheels=ride.JEEP.wheels.map(x=>part(this.sprite(x*PX,JEEP_TOP+ride.JEEP.wheelY*PX,'ride-wheel-0',DEPTH.wheel)))
    const lettering=(x:number,y:number,value:string,color:string)=>part(this.add.text(x,y,value,{fontFamily:FONT,fontSize:'8px',color,resolution:this.zoom}).setOrigin(.5).setDepth(DEPTH.text))
    this.board=lettering(238,JEEP_TOP+7,'CHITS - TANAW','#c8553d');lettering(154,JEEP_TOP+85,'CHITS EXPRESS','#a8432f')
    this.exhaust=this.add.graphics().setDepth(DEPTH.exhaust)
    // The headlight's pool lies flat on the road ahead of the jeepney.
    this.headlight=this.add.image(W+60,JEEP_BOTTOM-8,'ride-beam').setScale(PX).setDepth(DEPTH.light).setBlendMode(Phaser.BlendModes.ADD).setVisible(false)
    this.enterLeg(0)
    this.applySky()
    this.time.addEvent({delay:30_000,loop:true,callback:()=>this.applySky()})
    const now=this.time.now
    this.nextBumpAt=now+2500;this.nextOncomingAt=now+3500
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
    for(const kind of ['car','tricycle','jeepney'] as const)for(let paint=0;paint<4;paint++)texture(`oncoming-${kind}-${paint}`,vehicleArt(kind,paint,0))
    texture('ride-sun',new art.PixelArt(16,16).ellipse(8,8,7.5,7.5,'#fff6dc').ellipse(8,8,6,6,'#ffffff'))
    texture('ride-moon',new art.PixelArt(14,14).ellipse(7,7,6.5,6.5,'#f6f1de').set(5,5,'#ddd5bb').set(8,8,'#ddd5bb').set(9,4,'#ddd5bb').set(4,8,'#ddd5bb'))
    texture('ride-glow',glowArt(22,'#ffffff'));texture('ride-beam',new art.PixelArt(64,14).ellipse(32,7,31.5,6.5,'#ffd97a50').ellipse(26,7,22,4.6,'#ffe9a870').ellipse(18,7,12,3,'#fff3c490'))
    // Scenery painted for the time of day: mountains in the sky's own blue, the rest warmed at sunset and dimmed at night.
    const paint=(key:string,pixels:art.PixelArt,color:(sky:Sky)=>number)=>this.painted.push({texture:new PaintedTexture(this,key,pixels),color})
    // Landmarks further off take on some of the mountains' haze.
    for(const leg of ride.RIDE_LEGS){
      const scenery=ride.LEG_SCENERY[leg],haze=LEGS[leg].landmark.haze
      paint(`ride-${leg}-ridge`,scenery.ridge(),sky=>sky.far)
      for(const layer of ['fields','roadside','road','verge'] as const)paint(`ride-${leg}-${layer}`,scenery[layer](),dusk)
      paint(`ride-${leg}-landmark`,scenery.landmark(),sky=>mixColor(dusk(sky),sky.far,haze))
    }
    paint('ride-cloud',cloudArt(),sky=>sky.dark>.3?mixColor(sky.mid,0xffffff,.3):mixColor(0xffffff,sky.horizon,.25))
    createReactionTextures(this);createDrinkTextures(this)
  }
  private applySky(){
    const minute=this.opts.skyMinute??manilaMinute(),sky=skyAt(minute),sunAt=sunArc(minute),moonAt=moonArc(minute)
    const key=JSON.stringify([sky,sunAt===undefined,moonAt===undefined])
    if(key===this.skyKey)return
    this.skyKey=key;this.sky=sky;this.night=sky.dark>.3
    const g=this.skyGfx!
    g.clear()
    for(let i=0;i<15;i++){const t=i/14;g.fillStyle(t<.6?mixColor(sky.top,sky.mid,t/.6):mixColor(sky.mid,sky.horizon,(t-.6)/.4)).fillRect(-SIDE,i*SKY_BOTTOM/15,W+SIDE*2,SKY_BOTTOM/15+1)}
    for(let i=0;i<30&&sky.stars>0;i++)g.fillStyle(0xfff6dc,sky.stars*(i<6?1:.6)).fillRect(snap(-SIDE+(i*173)%(W+SIDE*2)),snap(8+(i*53)%150),i<6?PX:PX/2,i<6?PX:PX/2)
    this.cameras.main.setBackgroundColor(sky.horizon)
    for(const {texture,color} of this.painted)texture.paint(color(sky))
    this.drawGround()
    for(const cloud of this.clouds)cloud.setAlpha(1-sky.dark*.55)
    // The sun by day, the moon by night, hanging still above the mountains as the jeepney rolls on.
    const orb=this.orb!,sun=sunAt!==undefined,up=sun||moonAt!==undefined
    orb.body.setTexture(sun?'ride-sun':'ride-moon').setVisible(up);orb.glow.setVisible(up).setAlpha(sun?.9:.5*sky.stars+.2)
    // After dark: the cab glows, the roof lamps come on, and the headlight lights the road ahead.
    const time=this.night?'night':'day'
    this.interior?.setTexture(`ride-interior-${time}`);this.body?.setTexture(`ride-body-${time}`)
    this.headlight?.setVisible(sky.lights>.05).setAlpha(sky.lights)
  }
  private drawGround(){
    if(this.sky)this.ground?.clear().fillStyle(multiply(LEGS[this.leg].ground,dusk(this.sky))).fillRect(-SIDE,LAYERS.fields.y-4,W+SIDE*2,LAYERS.roadside.y-LAYERS.fields.y)
  }
  private get leg(){return ride.RIDE_LEGS[this.legIndex%ride.RIDE_LEGS.length]!}
  // One layer's row of tiles for a leg, laid from the layer's current scroll offset.
  private row(leg:ride.RideLeg,layer:Layer,offset:number){
    const shift=snap(offset)
    return Array.from({length:Math.ceil((W+SIDE*2)/TILE)+1},(_,i)=>this.add.image(-SIDE+i*TILE-shift,LAYERS[layer].y,`ride-${leg}-${layer}`).setOrigin(0,1).setScale(PX).setDepth(DEPTH[layer]))
  }
  // Arriving at a leg of the trip: its scenery fades in over the last one's (which then fades from the gaps), its
  // landmark comes into view, the route board changes, the place's name shows at the top and the driver points it out.
  private enterLeg(index:number){
    const now=this.time.now,fade=this.layers[0]!.rows.length>0&&!this.opts.reducedMotion
    this.legIndex=index;this.legEndsAt=now+LEG_MS
    const leg=this.leg,info=LEGS[leg]
    for(const layer of this.layers){
      const old=layer.rows[layer.rows.length-1],next=this.row(leg,layer.name,layer.offset)
      layer.rows.push(next)
      if(!old)continue
      const drop=()=>{for(const image of old)image.destroy();layer.rows=layer.rows.filter(row=>row!==old)}
      if(!fade){drop();continue}
      for(const image of next)image.setAlpha(0)
      this.tweens.add({targets:next,alpha:1,duration:CROSSFADE_MS,onComplete:()=>this.tweens.add({targets:old,alpha:0,duration:CROSSFADE_MS/2,onComplete:drop})})
    }
    for(const mark of this.landmarks){
      if(mark.leaving)continue
      mark.leaving=true
      const drop=()=>{mark.image.destroy();this.landmarks=this.landmarks.filter(other=>other!==mark)}
      if(fade)this.tweens.add({targets:mark.image,alpha:0,duration:CROSSFADE_MS,onComplete:drop});else drop()
    }
    const {x,y,depth,drift,own,gap}=info.landmark
    const image=this.add.image(x,y,`ride-${leg}-landmark`).setOrigin(.5,1).setScale(PX).setDepth(depth)
    if(fade){image.setAlpha(0);this.tweens.add({targets:image,alpha:1,duration:CROSSFADE_MS})}
    this.landmarks.push({image,x,speed:drift*info.pace+own,gap,leaving:false})
    this.board?.setText(info.board)
    this.drawGround()
    this.placeTag?.destroy()
    const tag=this.tag(W/2,24,info.place).setDepth(903)
    this.placeTag=tag
    this.time.delayedCall(5000,()=>{if(this.placeTag===tag)this.placeTag=undefined;tag.destroy()})
    this.introLine=info.lines[0]!;this.nextLineAt=now+1600
  }
  // Landmarks drift past at their own pace; one that leaves the screen comes round again after its gap.
  private updateLandmarks(step:number){
    const left=W/2-this.viewW/2,right=W/2+this.viewW/2
    for(const mark of this.landmarks){
      mark.x-=mark.speed*step
      const half=mark.image.displayWidth/2
      if(!mark.leaving&&mark.x+half<left)mark.x=right+half+mark.gap
      const x=snap(mark.x)
      if(mark.image.x!==x)mark.image.x=x
    }
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
  // The ride: the next leg when this one's up, scenery and clouds scrolling past (slower where traffic is heavy),
  // landmarks, wheels turning, a puff of exhaust, a bump now and then, oncoming traffic, blinking riders, the driver's chatter.
  override update(_:number,delta:number){
    const now=this.time.now,motion=!this.opts.reducedMotion,step=Math.min(delta,100)/1000,pace=LEGS[this.leg].pace
    if(now>=this.legEndsAt)this.enterLeg(this.legIndex+1)
    if(motion){
      for(const layer of this.layers){
        layer.offset=(layer.offset+layer.speed*pace*step)%TILE
        const shift=snap(layer.offset)
        for(const row of layer.rows)row.forEach((image,i)=>{const x=-SIDE+i*TILE-shift;if(image.x!==x)image.x=x})
      }
      for(const cloud of this.clouds){const x=cloud.x-step*8;cloud.x=x<-SIDE-60?W+SIDE+60:x}
      this.updateLandmarks(step)
      this.wheelTurn=(this.wheelTurn+step*1000/70*pace)%4
      const frame=Math.floor(this.wheelTurn)
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
      const line=this.introLine||pick([...LEGS[this.leg].lines.slice(1),...DRIVER_LINES])
      this.introLine=''
      const bubble=this.tag(300,JEEP_TOP-44,line,TAG_FONT,140).setDepth(901)
      this.driverBubble=bubble
      this.time.delayedCall(3600,()=>{if(this.driverBubble===bubble)this.driverBubble=undefined;bubble.destroy()})
    }
  }
  // Now and then a car, a tricycle or a jeepney (whatever the place's roads carry) comes the other way in the far lane.
  private updateOncoming(now:number,step:number){
    const car=this.oncoming
    if(car){
      car.x-=car.speed*step
      car.image.x=snap(car.x)
      if(car.x<-SIDE-120){car.image.destroy();this.oncoming=undefined;this.nextOncomingAt=now+5000+Math.random()*9000}
      return
    }
    if(now<this.nextOncomingAt)return
    const {traffic,pace}=LEGS[this.leg],kind=Math.random()<.6?traffic[0]!:traffic[1]!,x=W+SIDE+120
    this.oncoming={image:this.add.image(x,412,`oncoming-${kind}-${Math.floor(Math.random()*4)}`).setOrigin(.5,1).setScale(PX).setFlipX(true).setDepth(DEPTH.oncoming),x,speed:(480+Math.random()*120)*(.5+pace/2)}
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
  private fitCamera(width:number){this.viewW=width;this.cameras.main.setSize(width*this.zoom,H*this.zoom).centerOn(W/2,H/2)}
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
