import Phaser from 'phaser'
import {avatarOptions,type AvatarId} from '../shared/avatars'
import {benchSeats,scenes,type Pose} from '../shared/world'
import * as art from './pixelArt'
import * as street from './neighborhoodArt'
import {MAX_VIEW_W,MIN_VIEW_W,BUBBLE_GAP,FADE_COLOR,FADE_MS,FONT,NAME_TAG_GAP,PX,TAG_FONT,Tag,addTexture,characterPhase,createReactionTextures,currentDaylight,findPath,isHalloweenSeason,reactionTexture,setDepthIfChanged,swingDoor,tagDepth,tapSparks,visitorFrame,type BoardOrder,type Player,type WorldGame} from './common'

// Chits Neighborhood: the street outside the store. Loaded only when a visitor steps outside, as its own Phaser game.
export type NeighborhoodGame = WorldGame & {setPose:(id:string,pose:Pose,seat?:number)=>void;setBoard:(orders:BoardOrder[])=>void;vend:()=>void;goInside:()=>void}
type Options = {nickname:string;avatar:AvatarId;onMove:(x:number,y:number)=>void;onInteract:(kind:string)=>void;onPose:(pose:Pose,seat?:number)=>void;reducedMotion?:boolean;controlsEnabled?:boolean;zoom?:number;arriving?:boolean;daylight?:street.Daylight;viewWidth?:number}
// lift: how far the art is drawn above the network position (sitting draws the visitor up on the seat).
type Visitor = {sprite:Phaser.GameObjects.Image;label:Tag;avatar:string;phase:number;movingUntil:number;bubble?:Tag|Phaser.GameObjects.Image;pose:Pose;seat?:number;sitSince:number;lift:number}

const {width:W,height:H,floor,spawn}=scenes.outside,CELL=20
const DOOR={x:360,y:206,standY:280,halfWidth:24,triggerY:272,pushMs:220}
// Drawn lift of a seated visitor: from their floor spot in front of the bench up onto the seat.
const SEAT_LIFT=32,SIT_MS=220
const BENCH={x:120,y:282}
const VENDING={x:500,y:238,standX:500,standY:300}
const ORDER_BOARD={x:424,y:280,standX:420,standY:300}
const STORE_WINDOWS=[292,428]
// How far the scenery reaches past each end of the street, enough for the widest view.
const SIDE=(MAX_VIEW_W-W)/2
// Barricades and big pots just outside the walkable street, on the pavements and across the road.
const ENDS=[{y:300,name:'big-pot'},{y:392,name:'barricade'},{y:446,name:'barricade'},{y:512,name:'big-pot'}]
const LAMPS=[{x:210,y:298},{x:540,y:298},{x:250,y:472}]
const TREES=[{x:70,y:468},{x:650,y:468}]
// Closed neighbors, reserved for future expansion. Their bubbles sit above the sign board, not over it.
const SHOPS=[
  {area:new Phaser.Geom.Rectangle(24,88,192,168),x:120,y:110,lines:['Coming soon! A sari-sari store is opening here.','Coming soon! Snacks and sundries, right next door.']},
  {area:new Phaser.Geom.Rectangle(504,88,192,168),x:600,y:110,lines:['Coming soon! Hugot Burger is firing up the grill.','Coming soon! Burgers with feelings, right next door.']},
]
// A jack-o'-lantern by the door in the Halloween season, as inside.
const HALLOWEEN=isHalloweenSeason()
// Floor footprints: bench, vending machine, order board, door plant, three lamp posts, two tree trunks, the planter.
const obstacles=[
  {x:84,y:262,w:72,h:32},{x:476,y:262,w:48,h:18},{x:398,y:262,w:52,h:34},{x:304,y:262,w:24,h:18},
  ...LAMPS.map(lamp=>({x:lamp.x-10,y:lamp.y+32,w:20,h:18})),
  ...TREES.map(tree=>({x:tree.x-14,y:tree.y+28,w:28,h:20})),
  {x:432,y:512,w:56,h:30},
  ...(HALLOWEEN?[{x:276,y:270,w:26,h:22}]:[]),
].map(box=>new Phaser.Geom.Rectangle(box.x,box.y,box.w,box.h))
function bounded(x:number,y:number){return x>=floor.minX&&x<=floor.maxX&&y>=floor.minY&&y<=floor.maxY&&!obstacles.some(r=>r.contains(x,y))}
// The walkable grid point nearest a tap; tapping a wall or the hedge walks as close as it can.
function nearestOpen(x:number,y:number){
  const cx=Math.round(Math.max(floor.minX,Math.min(floor.maxX,x))/CELL),cy=Math.round(Math.max(floor.minY,Math.min(floor.maxY,y))/CELL)
  for(let ring=0;ring<=4;ring++)for(let dy=-ring;dy<=ring;dy++)for(let dx=-ring;dx<=ring;dx++){
    if(Math.max(Math.abs(dx),Math.abs(dy))!==ring)continue
    const px=(cx+dx)*CELL,py=(cy+dy)*CELL
    if(bounded(px,py))return {x:px,y:py}
  }
}
function pathFind(start:Phaser.Math.Vector2,target:Phaser.Math.Vector2){return findPath(start,target,bounded,CELL)}
// Lamps light up and the sky changes with the store's Manila clock (currentDaylight).
const SHADE:Record<street.Daylight,{color:number;alpha:number;lamps:number}>={day:{color:0,alpha:0,lamps:0},dusk:{color:0x5a3a5a,alpha:.14,lamps:.65},night:{color:0x141c38,alpha:.34,lamps:1}}
// Above everything in the world (furniture, characters), below name tags: the night shade, then added light.
const SHADE_DEPTH=590,LIGHT_DEPTH=592,LIT_DEPTH=596

class NeighborhoodScene extends Phaser.Scene{
  private opts:Options
  private zoom:number
  private self?:Visitor
  private selfId=''
  private remotes=new Map<string,Visitor>()
  private direction=new Phaser.Math.Vector2(0,0)
  private path:Phaser.Math.Vector2[]=[]
  private afterPath?:()=>void
  private keys?:Record<string,Phaser.Input.Keyboard.Key>
  private lastMove=0
  private lastX=spawn.x
  private lastY=spawn.y
  private door?:Phaser.GameObjects.Image
  private doorPush=0
  private doorTriggered=false
  private doorReadyAt=0
  private exiting?:{x:number;y:number}
  private daylight:street.Daylight='day'
  private sky?:Phaser.GameObjects.TileSprite
  private clouds:Phaser.GameObjects.Image[]=[]
  private shade?:Phaser.GameObjects.Rectangle
  private lamps:{post:Phaser.GameObjects.Image;glow:Phaser.GameObjects.Image;pool:Phaser.GameObjects.Image;x:number;y:number;flareUntil:number}[]=[]
  private windowGlows:Phaser.GameObjects.Image[]=[]
  private moths?:Phaser.GameObjects.Graphics
  private mothFrame=-1
  private trees:{sprite:Phaser.GameObjects.Image;rustleUntil:number}[]=[]
  private vending?:Phaser.GameObjects.Image
  private vendUntil=0
  private boardReady?:Phaser.GameObjects.Text
  private boardPrep?:Phaser.GameObjects.Text
  private shopBubble?:Tag
  private shopBubbleTimer?:Phaser.Time.TimerEvent
  private selfBubbleTimer?:Phaser.Time.TimerEvent
  constructor(opts:Options){super('Neighborhood');this.opts=opts;this.zoom=opts.zoom??1}
  private sprite(x:number,y:number,name:string,depth:number){return this.add.image(x,y,name).setScale(PX).setDepth(depth)}
  // Standing furniture: depth follows the object's base so visitors walk in front and behind.
  private floorSprite(x:number,y:number,name:string){const image=this.sprite(x,y,name,0);image.setDepth(y+image.displayHeight/2-14);return image}
  private text(x:number,y:number,value:string,size:number,color:string,depth:number){
    return this.add.text(x,y,value,{fontFamily:FONT,fontSize:`${size}px`,color,resolution:this.zoom}).setOrigin(.5).setDepth(depth)
  }
  private tag(x:number,y:number,value:string,size=TAG_FONT,wrap?:number){return new Tag(this,x,y,value,{size,wrap,resolution:this.zoom})}
  create(){
    const camera=this.cameras.main
    camera.setZoom(this.zoom).setBounds(0,0,W,H).setBackgroundColor('#6e4a31')
    this.createTextures()
    this.daylight=this.opts.daylight??currentDaylight()
    this.sky=this.add.tileSprite(-SIDE,0,(W+SIDE*2)/PX,52,`sky-${this.daylight}`).setOrigin(0).setScale(PX).setDepth(-2)
    this.clouds=[[-380,14],[70,20],[300,10],[560,26],[860,16],[1120,22]].map(([x,y])=>this.sprite(x!,y!,'cloud',-1))
    this.add.image(0,0,'street').setOrigin(0).setScale(PX).setDepth(0)
    // Past both ends the street carries on (seen on wide screens); the right side is the left piece mirrored.
    const edgeW=street.EDGE.width*PX
    this.add.image(-edgeW,0,'street-edge').setOrigin(0).setScale(PX).setDepth(0)
    this.add.image(W,0,'street-edge').setOrigin(0).setScale(PX).setDepth(0).setFlipX(true)
    for(const end of ENDS)for(const x of [-14,W+14])this.floorSprite(x,end.y,end.name)
    // Signs are lit, so they stay bright above the evening shade.
    const sign=this.text(360,70,'CHITS STORE',16,'#fff3d6',LIT_DEPTH).setStroke('#fff3d6',1).setShadow(0,2,'#4b301f',0,false,true)
    this.sprite(sign.x+sign.width/2+16,68,'sparkle',LIT_DEPTH)
    this.sprite(sign.x-sign.width/2-26,80,'head-palitaw',LIT_DEPTH)
    this.text(360,90,'MERYENDA HUB',8,'#f6e3c0',LIT_DEPTH)
    this.text(120,126,'SARI-SARI',10,'#fff8ea',2).setShadow(0,1,'#2d4f4a',0,false,true)
    this.text(600,126,'HUGOT BURGER',10,'#fff8ea',2).setShadow(0,1,'#3b2619',0,false,true)
    for(const x of [120,600])this.text(x,190,'COMING SOON',8,'#5e3d27',2)
    this.door=this.sprite(DOOR.x,DOOR.y,this.opts.arriving?'shop-door-3':'shop-door-0',1)
    this.floorSprite(BENCH.x,BENCH.y,'bench')
    this.vending=this.floorSprite(VENDING.x,VENDING.y,'vending-idle')
    this.text(VENDING.x-4,VENDING.y-31,'COLD',8,'#ad513f',this.vending.depth+1)
    const board=this.floorSprite(ORDER_BOARD.x,ORDER_BOARD.y,'order-board')
    // Order numbers only: the street board never shows the names staff add.
    this.text(ORDER_BOARD.x,ORDER_BOARD.y-17,'READY',8,'#fff6e2',board.depth+1)
    this.boardReady=this.text(ORDER_BOARD.x,ORDER_BOARD.y-3,'—',11,'#a9ec8f',board.depth+1).setShadow(0,1,'#0b1a13',0,false,true)
    this.boardPrep=this.text(ORDER_BOARD.x,ORDER_BOARD.y+9,'0 PREP',8,'#ffd45e',board.depth+1)
    this.floorSprite(316,268,'plant-small')
    if(HALLOWEEN)this.floorSprite(288,282,'pumpkin-glow')
    this.floorSprite(460,528,'planter')
    this.trees=TREES.map(({x,y})=>({sprite:this.floorSprite(x,y,'tree-0'),rustleUntil:0}))
    this.shade=this.add.rectangle(-SIDE,0,W+SIDE*2,H,0,0).setOrigin(0).setDepth(SHADE_DEPTH)
    for(const x of STORE_WINDOWS)this.windowGlows.push(this.sprite(x,184,'window-glow',LIGHT_DEPTH).setBlendMode(Phaser.BlendModes.ADD))
    for(const w of street.EDGE_WINDOWS)for(const x of [(w.x-street.EDGE.width)*PX,W+(street.EDGE.width-w.x)*PX])
      this.windowGlows.push(this.sprite(x,w.y*PX,'house-glow',LIGHT_DEPTH).setBlendMode(Phaser.BlendModes.ADD))
    this.lamps=LAMPS.map(({x,y})=>({post:this.floorSprite(x,y,'lamp-off'),x,y,flareUntil:0,
      glow:this.sprite(x,y-38,'lamp-glow',LIGHT_DEPTH).setBlendMode(Phaser.BlendModes.ADD),
      pool:this.sprite(x,y+50,'light-pool',LIGHT_DEPTH).setBlendMode(Phaser.BlendModes.ADD)}))
    this.moths=this.add.graphics().setDepth(LIT_DEPTH)
    this.applyDaylight()
    this.time.addEvent({delay:60_000,loop:true,callback:()=>{const next=this.opts.daylight??currentDaylight();if(next!==this.daylight){this.daylight=next;this.applyDaylight()}}})
    const avatar=this.textures.exists(this.opts.avatar)?this.opts.avatar:'mochi'
    const sprite=this.sprite(spawn.x,spawn.y,avatar,spawn.y+10)
    this.self={sprite,label:this.tag(spawn.x,spawn.y-NAME_TAG_GAP,this.opts.nickname).setDepth(tagDepth(spawn.y)),avatar,phase:characterPhase(this.opts.nickname),movingUntil:0,pose:'stand',sitSince:0,lift:0}
    this.fitCamera(this.opts.viewWidth??MIN_VIEW_W)
    camera.centerOn(spawn.x,H/2).startFollow(sprite,true,this.opts.reducedMotion?1:.12,1)
    // Stepping out of the store: fade in while the door swings shut behind the visitor.
    if(this.opts.arriving){
      if(!this.opts.reducedMotion)camera.fadeIn(FADE_MS,...FADE_COLOR)
      this.time.delayedCall(this.opts.reducedMotion?0:450,()=>{if(this.door)swingDoor(this,this.door,'shop-door',false,Boolean(this.opts.reducedMotion))})
    }
    this.doorReadyAt=this.time.now+1200
    if(this.input.keyboard){
      this.keys=this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT',false) as Record<string,Phaser.Input.Keyboard.Key>
      this.input.keyboard.on('keydown',(event:KeyboardEvent)=>{
        if(this.inputBlocked()||event.isComposing){this.input.keyboard?.resetKeys();return}
        if(event.key.startsWith('Arrow')&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey)event.preventDefault()
      })
    }
    this.setControlsEnabled(this.opts.controlsEnabled!==false)
    this.input.on('pointerdown',(pointer:Phaser.Input.Pointer)=>this.tap(pointer.worldX,pointer.worldY))
  }
  private createTextures(){
    const texture=(name:string,pixels:art.PixelArt)=>addTexture(this,name,pixels)
    texture('street',street.streetArt());texture('street-edge',street.streetEdgeArt())
    texture('barricade',street.barricadeArt());texture('big-pot',street.bigPotArt());texture('house-glow',street.glowArt(16,'#ffcf7a'))
    for(const time of ['day','dusk','night'] as const)texture(`sky-${time}`,street.skyArt(time))
    texture('cloud',street.cloudArt())
    for(const option of avatarOptions){
      const id=option.id
      texture(id,art.visitorArt(id,'idle'));texture(`${id}-blink`,art.visitorArt(id,'blink'))
      texture(`${id}-step1`,art.visitorArt(id,'step1'));texture(`${id}-step2`,art.visitorArt(id,'step2'))
      texture(`${id}-sit`,street.sittingVisitorArt(id));texture(`${id}-sit-blink`,street.sittingVisitorArt(id,true))
    }
    for(const frame of [0,1,2,3] as const)texture(`shop-door-${frame}`,street.storeDoorArt(frame))
    texture('bench',street.benchArt())
    for(const frame of ['idle','blink','vend'] as const)texture(`vending-${frame}`,street.vendingArt(frame))
    texture('order-board',street.orderBoardArt())
    texture('lamp-off',street.lampArt(false));texture('lamp-on',street.lampArt(true))
    texture('lamp-glow',street.glowArt(18,'#ffd98a'));texture('window-glow',street.glowArt(22,'#ffcf7a'));texture('light-pool',street.lightPoolArt())
    texture('tree-0',street.treeArt(0));texture('tree-1',street.treeArt(1))
    texture('planter',street.planterArt());texture('leaf',street.leafArt());texture('can',street.canArt())
    texture('plant-small',art.smallPlantArt());texture('sparkle',art.sparkleArt());texture('head-palitaw',art.headArt('palitaw'))
    if(HALLOWEEN)texture('pumpkin-glow',art.pumpkinArt('glow'))
    createReactionTextures(this)
  }
  private applyDaylight(){
    const {color,alpha}=SHADE[this.daylight]
    this.sky?.setTexture(`sky-${this.daylight}`)
    for(const cloud of this.clouds)cloud.setVisible(this.daylight!=='night').setAlpha(this.daylight==='dusk'?.75:1)
    this.shade?.setFillStyle(color,alpha).setVisible(alpha>0)
    for(const glow of this.windowGlows)glow.setVisible(this.daylight!=='day')
  }
  private tap(x:number,y:number){
    if(this.inputBlocked())return
    const spark=()=>{if(!this.opts.reducedMotion)tapSparks(this,x,y)}
    const interact=(tx:number,ty:number,kind:string)=>{spark();this.walkTo(tx,ty,()=>this.opts.onInteract(kind))}
    if(Math.abs(x-DOOR.x)<=22&&y>=156&&y<=256){interact(DOOR.x,DOOR.standY,'store');return}
    if(Math.abs(x-VENDING.x)<=24&&y>=196&&y<=284){interact(VENDING.standX,VENDING.standY,'vending');return}
    if(Math.abs(x-BENCH.x)<=36&&y>=256&&y<=302){spark();this.chooseSeat(x);return}
    if(Math.abs(x-ORDER_BOARD.x)<=28&&y>=252&&y<=306){interact(ORDER_BOARD.standX,ORDER_BOARD.standY,'board');return}
    const lamp=this.lamps.find(lamp=>Math.abs(x-lamp.x)<=14&&y>=lamp.y-50&&y<=lamp.y+50)
    if(lamp){spark();lamp.flareUntil=this.time.now+1400;return}
    const tree=this.trees.find(({sprite})=>Math.abs(x-sprite.x)<=36&&y>=sprite.y-46&&y<=sprite.y+30)
    if(tree){spark();this.rustle(tree);return}
    const shop=SHOPS.find(shop=>shop.area.contains(x,y))
    if(shop){spark();this.shopSpeak(shop);return}
    // Tapping the store front (not the door) walks over to the door.
    if(x>=240&&x<=480&&y<256){spark();this.walkTo(DOOR.x,DOOR.standY);return}
    const point=nearestOpen(x,y)
    if(point){if(!this.opts.reducedMotion)tapSparks(this,point.x,point.y);this.walkTo(point.x,point.y)}
  }
  private seatTaken(seat:number){return [...this.remotes.values()].some(remote=>remote.pose==='sit'&&remote.seat===seat)}
  // The free seat nearest the tap. Sitting needs no confirmation first; the server stands the visitor up if it was taken.
  private chooseSeat(x:number){
    const self=this.self
    if(!self)return
    const order=benchSeats.map((seat,index)=>({seat,index})).sort((a,b)=>Math.abs(a.seat.x-x)-Math.abs(b.seat.x-x))
    const free=order.find(({index})=>!this.seatTaken(index))
    if(!free){this.say('The bench is full!');return}
    if(self.pose==='sit'&&self.seat===free.index)return
    this.walkTo(free.seat.x,free.seat.y,()=>this.sit(free.index))
  }
  private sit(seat:number){
    const self=this.self,spot=benchSeats[seat]
    if(!self||!spot)return
    if(this.seatTaken(seat)){this.say('Someone is sitting there!');return}
    self.sprite.setPosition(spot.x,spot.y)
    // Send the final floor position first so the server never reads a late move as standing up.
    this.flushMove()
    self.pose='sit';self.seat=seat;self.sitSince=this.time.now
    this.opts.onPose('sit',seat)
  }
  private standUp(notify=true){
    const self=this.self
    if(!self||self.pose!=='sit')return
    self.pose='stand';self.seat=undefined
    if(notify)this.opts.onPose('stand')
  }
  private flushMove(){
    const sprite=this.self?.sprite
    if(!sprite||Math.hypot(sprite.x-this.lastX,sprite.y-this.lastY)<=.5)return
    this.lastMove=this.time.now;this.lastX=sprite.x;this.lastY=sprite.y;this.opts.onMove(Math.round(sprite.x),Math.round(sprite.y))
  }
  // A quick line above the visitor's own head, e.g. when the bench is full.
  private say(text:string){
    const self=this.self
    if(!self)return
    self.bubble?.destroy();this.selfBubbleTimer?.remove(false)
    const bubble=this.tag(self.sprite.x,self.sprite.y-self.lift-BUBBLE_GAP,text,TAG_FONT,140).setDepth(900)
    self.bubble=bubble
    this.selfBubbleTimer=this.time.delayedCall(2200,()=>{if(self.bubble===bubble)self.bubble=undefined;bubble.destroy()})
  }
  private shopSpeak(shop:typeof SHOPS[number]){
    this.shopBubbleTimer?.remove(false);this.shopBubble?.destroy()
    const bubble=this.tag(shop.x,shop.y,shop.lines[Math.floor(Math.random()*shop.lines.length)]!,TAG_FONT,150).setDepth(900)
    this.shopBubble=bubble
    this.shopBubbleTimer=this.time.delayedCall(3200,()=>{if(this.shopBubble===bubble)this.shopBubble=undefined;bubble.destroy();this.shopBubbleTimer=undefined})
  }
  // The canopy shakes a few times and one leaf drifts down.
  private rustle(tree:typeof this.trees[number]){
    if(this.time.now<tree.rustleUntil)return
    tree.rustleUntil=this.time.now+600
    if(this.opts.reducedMotion)return
    const {x,y}=tree.sprite,side=Math.random()<.5?-1:1
    const leaf=this.sprite(x+side*20,y-30,'leaf',tree.sprite.depth+1),progress={value:0}
    this.tweens.add({targets:progress,value:1,duration:1300,onUpdate:()=>{
      const p=progress.value
      leaf.setPosition(x+side*(20+Math.round(p*10)*PX)+(Math.floor(p*8)%2?PX:0),y-30+Math.round(p*30)*PX).setAlpha(p<.75?1:(1-p)*4)
    },onComplete:()=>leaf.destroy()})
  }
  vend(){
    const machine=this.vending
    if(!machine||this.time.now<this.vendUntil)return
    this.vendUntil=this.time.now+1600
    if(this.opts.reducedMotion)return
    // A can rattles down into the tray.
    const can=this.sprite(machine.x-2,machine.y-6,'can',machine.depth+1).setAlpha(0),progress={value:0}
    this.tweens.add({targets:progress,value:1,duration:420,delay:240,onUpdate:()=>{can.setAlpha(1).setY(machine.y-6+Math.round(progress.value*10)*PX)},onComplete:()=>can.destroy()})
  }
  setBoard(orders:BoardOrder[]){
    const ready=orders.find(order=>order.status==='Ready'),preparing=orders.filter(order=>order.status==='Preparing').length
    const number=ready?Array.from(ready.number).slice(0,6).join(''):''
    this.boardReady?.setText(ready?`#${number}`:'—').setAlpha(ready?1:.6)
    this.boardPrep?.setText(`${Math.min(preparing,99)} PREP`)
  }
  walkTo(x:number,y:number,callback?:()=>void){
    if(!this.self||this.inputBlocked())return
    this.path=pathFind(new Phaser.Math.Vector2(this.self.sprite.x,this.self.sprite.y),new Phaser.Math.Vector2(x,y));this.afterPath=callback
    // Already standing on the target tile: there is no path to walk, so interact right away.
    if(!this.path.length&&callback&&Math.hypot(this.self.sprite.x-Math.round(x/CELL)*CELL,this.self.sprite.y-Math.round(y/CELL)*CELL)<CELL){this.afterPath=undefined;callback()}
  }
  // The page's "Go inside" button: walk to the door and go in, as if the door had been tapped.
  goInside(){
    this.walkTo(DOOR.x,DOOR.standY,()=>this.opts.onInteract('store'))
    if(!this.inputBlocked()&&!this.path.length&&this.afterPath){this.afterPath=undefined;this.opts.onInteract('store')}
  }
  setDirection(x:number,y:number){if(this.inputBlocked()){this.resetMovement();return}this.direction.set(x,y);if(x||y){this.path=[];this.afterPath=undefined}}
  private inputBlocked(){
    const active=document.activeElement
    return this.opts.controlsEnabled===false||Boolean(document.querySelector('dialog[open]'))||
      (active instanceof HTMLElement&&(active.isContentEditable||Boolean(active.closest('input,textarea,select,[role="textbox"]'))))
  }
  private resetMovement(){this.direction.set(0,0);this.path=[];this.afterPath=undefined;this.input?.keyboard?.resetKeys()}
  setControlsEnabled(value:boolean){this.opts.controlsEnabled=value;this.resetMovement();if(this.input?.keyboard)this.input.keyboard.enabled=value}
  // Narrower than the street, the camera follows the visitor along it; wider, the whole street is in view, centred.
  private fitCamera(width:number){
    const extra=Math.max(0,width-W)/2
    this.cameras.main.setSize(width*this.zoom,H*this.zoom).setBounds(-extra,0,W+extra*2,H)
  }
  setViewWidth(width:number){
    if(!this.sys?.isActive())return
    this.scale.setGameSize(width*this.zoom,H*this.zoom)
    this.fitCamera(width)
  }
  setReducedMotion(value:boolean){this.opts.reducedMotion=value;this.cameras.main.setLerp(value?1:.12,1)}
  // Frame swaps and whole-pixel lifts only, as in the store. A seated visitor hops up onto the seat.
  private animateVisitor(visitor:Visitor,moving:boolean){
    const {sprite,avatar,phase}=visitor,motion=!this.opts.reducedMotion
    let texture=avatar,lift=0
    if(visitor.pose==='sit'){
      const progress=motion?Math.min(1,(this.time.now-visitor.sitSince)/SIT_MS):1
      lift=Math.round((SEAT_LIFT*progress+Math.sin(progress*Math.PI)*6)/PX)*PX
      texture=progress<.5?avatar:`${avatar}-sit${motion&&(this.time.now+phase)%4200<130?'-blink':''}`
    }else if(motion)({texture,lift}=visitorFrame(avatar,phase,this.time.now,moving))
    if(!this.textures.exists(texture))texture=avatar
    if(sprite.texture.key!==texture)sprite.setTexture(texture)
    // Animate only the artwork: x/y remain the collision and network coordinates.
    sprite.setOrigin(.5,.5+lift/sprite.displayHeight)
    if(lift!==visitor.lift){visitor.lift=lift;this.placeTags(visitor)}
  }
  private placeTags(visitor:Visitor){
    const {sprite,label,bubble,lift}=visitor,top=sprite.y-lift
    label.setPosition(sprite.x,top-NAME_TAG_GAP)
    if(bubble instanceof Tag)bubble.setPosition(sprite.x,top-BUBBLE_GAP)
    else bubble?.setPosition(sprite.x,top-BUBBLE_GAP-20)
    setDepthIfChanged(sprite,sprite.y+10);setDepthIfChanged(label,tagDepth(sprite.y))
  }
  // Lamps glow by evening and pulse very slightly; moths circle the lit heads at night. Redrawn only on a new frame.
  private updateAmbient(){
    const now=this.time.now,motion=!this.opts.reducedMotion,{lamps:base}=SHADE[this.daylight]
    this.lamps.forEach((lamp,i)=>{
      const flare=now<lamp.flareUntil,on=flare||base>0
      const texture=on?'lamp-on':'lamp-off'
      if(lamp.post.texture.key!==texture)lamp.post.setTexture(texture)
      const pulse=motion?Math.round((Math.sin(now/900+i*2)*.5+.5)*4)/40:0
      const alpha=flare?1:base?Math.min(1,base-.1+pulse):0
      if(lamp.glow.alpha!==alpha){lamp.glow.setAlpha(alpha).setVisible(alpha>0);lamp.pool.setAlpha(alpha).setVisible(alpha>0)}
    })
    const mothFrame=motion&&this.daylight==='night'?Math.floor(now/110)%24:-1
    if(mothFrame!==this.mothFrame&&this.moths){
      this.mothFrame=mothFrame
      this.moths.clear()
      if(mothFrame>=0)this.lamps.forEach((lamp,i)=>{
        for(const turn of [0,12]){
          const angle=((mothFrame+turn+i*5)%24)/24*Math.PI*2
          this.moths!.fillStyle(0xfff6dc,.9).fillRect(Math.round((lamp.x+Math.cos(angle)*12)/PX)*PX,Math.round((lamp.y-42+Math.sin(angle*2)*5)/PX)*PX,PX,PX)
        }
      })
    }
    for(const tree of this.trees){
      const frame=motion&&(now<tree.rustleUntil?Math.floor(now/90)%2:Math.floor((now+tree.sprite.x*7)/1700)%2)?'tree-1':'tree-0'
      if(tree.sprite.texture.key!==frame)tree.sprite.setTexture(frame)
    }
    if(motion)this.clouds.forEach((cloud,i)=>{const x=Math.round(((now/1000*(2+i%3)+i*330)%(W+SIDE*2+80)-SIDE-40)/PX)*PX;if(cloud.x!==x)cloud.setX(x)})
    const machine=this.vending
    if(machine){
      const vending=now<this.vendUntil
      const texture=vending&&now>this.vendUntil-1000?'vending-vend':(vending||motion)&&now%1800<300?'vending-blink':'vending-idle'
      if(machine.texture.key!==texture)machine.setTexture(texture)
      const shake=motion&&vending&&now<this.vendUntil-1200?(Math.floor(now/50)%2?PX/2:-PX/2):0
      if(machine.x!==VENDING.x+shake)machine.setX(VENDING.x+shake)
    }
  }
  // Holding up (keys or joystick) against the store door for a moment walks back inside.
  private checkDoorPush(pushY:number,delta:number){
    const sprite=this.self!.sprite
    if(sprite.y>DOOR.triggerY+16)this.doorTriggered=false
    const pushing=pushY<-.5&&sprite.y<=DOOR.triggerY&&Math.abs(sprite.x-DOOR.x)<=DOOR.halfWidth
    this.doorPush=pushing?this.doorPush+delta:0
    if(this.doorPush>=DOOR.pushMs&&!this.doorTriggered&&this.time.now>=this.doorReadyAt){this.doorTriggered=true;this.opts.onInteract('store')}
  }
  exitScene(){
    return new Promise<void>(resolve=>{
      const self=this.self
      if(!self||!this.door){resolve();return}
      this.standUp(false)
      this.exiting={x:self.sprite.x,y:self.sprite.y};this.resetMovement();this.doorTriggered=true
      const instant=Boolean(this.opts.reducedMotion)
      swingDoor(this,this.door,'shop-door',true,instant,()=>{
        if(instant){resolve();return}
        // Step in through the door while the screen fades.
        this.tweens.add({targets:self.sprite,y:self.sprite.y-16,alpha:0,duration:FADE_MS,onUpdate:()=>{self.label.setPosition(self.sprite.x,self.sprite.y-NAME_TAG_GAP).setAlpha(self.sprite.alpha)}})
        this.cameras.main.fade(FADE_MS,...FADE_COLOR,true,(_:unknown,progress:number)=>{if(progress>=1)resolve()})
      })
    })
  }
  cancelExit(){
    const from=this.exiting,self=this.self
    this.exiting=undefined;this.doorPush=0;this.doorReadyAt=this.time.now+1200
    if(from&&self){this.tweens.killTweensOf(self.sprite);self.sprite.setPosition(from.x,from.y).setAlpha(1);self.label.setAlpha(1);this.placeTags(self)}
    if(this.opts.reducedMotion)this.cameras.main.resetFX();else this.cameras.main.fadeEffect.start(false,FADE_MS,...FADE_COLOR,true)
    if(this.door)swingDoor(this,this.door,'shop-door',false,Boolean(this.opts.reducedMotion))
  }
  override update(_:number,delta:number){
    this.updateAmbient()
    for(const remote of this.remotes.values())this.animateVisitor(remote,this.time.now<remote.movingUntil)
    const self=this.self
    if(!self)return
    if(this.exiting||this.inputBlocked()){this.resetMovement();this.doorPush=0;this.animateVisitor(self,Boolean(this.exiting));return}
    const sprite=self.sprite
    const previousX=sprite.x,previousY=sprite.y
    let vx=this.direction.x,vy=this.direction.y
    if(this.keys){
      const k=this.keys;vx+=(k.A?.isDown||k.LEFT?.isDown?-1:0)+(k.D?.isDown||k.RIGHT?.isDown?1:0)
      vy+=(k.W?.isDown||k.UP?.isDown?-1:0)+(k.S?.isDown||k.DOWN?.isDown?1:0)
    }
    this.checkDoorPush(vy,delta)
    // Any movement gets a seated visitor back on their feet first.
    if(self.pose==='sit'&&(vx||vy||this.path.length))this.standUp()
    if(!vx&&!vy&&this.path.length){
      const p=this.path[0]!,diff=new Phaser.Math.Vector2(p.x-sprite.x,p.y-sprite.y)
      if(diff.length()<4){sprite.setPosition(p.x,p.y);this.path.shift();if(!this.path.length){const action=this.afterPath;this.afterPath=undefined;action?.()}}else{diff.normalize();vx=diff.x;vy=diff.y}
    }
    const length=Math.hypot(vx,vy)
    if(length&&self.pose!=='sit'){vx/=length;vy/=length;const s=Math.min(delta/1000,.05)*115
      if(bounded(sprite.x+vx*s,sprite.y))sprite.x+=vx*s
      if(bounded(sprite.x,sprite.y+vy*s))sprite.y+=vy*s
    }
    this.animateVisitor(self,Math.hypot(sprite.x-previousX,sprite.y-previousY)>.1)
    this.placeTags(self)
    if(this.time.now-this.lastMove>90&&Math.hypot(sprite.x-this.lastX,sprite.y-this.lastY)>1){
      this.lastMove=this.time.now;this.lastX=sprite.x;this.lastY=sprite.y;this.opts.onMove(Math.round(sprite.x),Math.round(sprite.y))
    }
  }
  setPlayers(players:Player[],selfId:string){
    if(selfId!==this.selfId&&this.self){
      const own=players.find(p=>p.id===selfId)
      if(own){this.self.sprite.setPosition(own.x,own.y);this.lastX=own.x;this.lastY=own.y;this.path=[];this.afterPath=undefined;this.standUp(false)}
    }
    this.selfId=selfId
    const incoming=new Set(players.filter(p=>p.id!==selfId).map(p=>p.id))
    for(const [id,p] of this.remotes)if(!incoming.has(id)){p.sprite.destroy();p.label.destroy();p.bubble?.destroy();this.remotes.delete(id)}
    for(const p of players){if(p.id===selfId)continue
      let remote=this.remotes.get(p.id)
      if(!remote){
        const avatar=this.textures.exists(p.avatar)?p.avatar:'mochi'
        remote={sprite:this.sprite(p.x,p.y,avatar,p.y+10),label:this.tag(p.x,p.y-NAME_TAG_GAP,p.nickname).setDepth(tagDepth(p.y)),avatar,phase:characterPhase(p.id),movingUntil:0,pose:'stand',sitSince:-Infinity,lift:0}
        this.remotes.set(p.id,remote)
      }
      // Someone already seated when this visitor arrives is drawn seated, without the hop.
      if(p.pose==='sit'&&remote.pose!=='sit'){remote.sprite.setPosition(p.x,p.y);remote.pose='sit';remote.seat=p.seat;remote.sitSince=-Infinity;this.placeTags(remote)}
      else if(p.pose!=='sit')this.movePlayer(p.id,p.x,p.y)
    }
  }
  setPose(id:string,pose:Pose,seat?:number){
    if(id===this.selfId){if(pose==='stand'){this.standUp(false);this.say('Someone is sitting there!')}return}
    const remote=this.remotes.get(id)
    if(!remote)return
    if(pose==='sit'){
      if(remote.pose==='sit'&&remote.seat===seat)return
      this.tweens.killTweensOf(remote.sprite)
      const spot=seat===undefined?undefined:benchSeats[seat]
      if(spot)remote.sprite.setPosition(spot.x,spot.y)
      remote.pose='sit';remote.seat=seat;remote.sitSince=this.time.now
    }else{remote.pose='stand';remote.seat=undefined}
    this.placeTags(remote)
  }
  movePlayer(id:string,x:number,y:number){
    const remote=this.remotes.get(id)
    if(!remote)return
    // A move means they stood up; the server never sends moves for a seated visitor.
    if(remote.pose==='sit'){remote.pose='stand';remote.seat=undefined}
    if(Math.hypot(x-remote.sprite.x,y-remote.sprite.y)<=.5)return
    remote.movingUntil=this.time.now+200
    this.tweens.killTweensOf(remote.sprite)
    this.tweens.add({targets:remote.sprite,x,y,duration:115,onUpdate:()=>this.placeTags(remote)})
  }
  private makeBubble(visitor:Visitor,text:string){
    const {sprite,lift}=visitor,reaction=reactionTexture(text)
    if(reaction)return this.sprite(sprite.x,sprite.y-lift-BUBBLE_GAP-20,reaction,900)
    return this.tag(sprite.x,sprite.y-lift-BUBBLE_GAP,text.slice(0,32),TAG_FONT,140).setDepth(900)
  }
  showBubble(id:string,text:string){
    const target=id===this.selfId?this.self:this.remotes.get(id)
    if(!target)return
    if(target===this.self)this.selfBubbleTimer?.remove(false)
    target.bubble?.destroy()
    const bubble=this.makeBubble(target,text)
    target.bubble=bubble
    this.time.delayedCall(3500,()=>{if(target.bubble===bubble)target.bubble=undefined;bubble.destroy()})
  }
}

export function createNeighborhood(el:HTMLElement,opts:Options):NeighborhoodGame{
  // Same render setup as the store: a whole-number zoom of the view, scaled the last step by the browser.
  const zoom=Math.max(1,Math.min(4,Math.round(opts.zoom??1))),viewW=opts.viewWidth??MIN_VIEW_W
  const scene=new NeighborhoodScene({...opts,zoom})
  const game=new Phaser.Game({type:Phaser.AUTO,parent:el,width:viewW*zoom,height:H*zoom,backgroundColor:'#6e4a31',pixelArt:true,
    scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_HORIZONTALLY,width:viewW*zoom,height:H*zoom},scene:[scene],render:{antialias:false}})
  const active=()=>Boolean(scene.sys?.isActive())
  return {game,setDirection:(x,y)=>scene.setDirection(x,y),setPlayers:(players,id)=>{if(active())scene.setPlayers(players,id)},movePlayer:(id,x,y)=>{if(active())scene.movePlayer(id,x,y)},
    showBubble:(id,text)=>{if(active())scene.showBubble(id,text)},setReducedMotion:value=>{if(active())scene.setReducedMotion(value)},setControlsEnabled:value=>scene.setControlsEnabled(value),
    exitScene:()=>active()?scene.exitScene():Promise.resolve(),cancelExit:()=>{if(active())scene.cancelExit()},setViewWidth:width=>scene.setViewWidth(width),
    setPose:(id,pose,seat)=>{if(active())scene.setPose(id,pose,seat)},setBoard:orders=>{if(active())scene.setBoard(orders)},vend:()=>{if(active())scene.vend()},goInside:()=>{if(active())scene.goInside()}}
}
