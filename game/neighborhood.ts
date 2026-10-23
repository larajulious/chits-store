import Phaser from 'phaser'
import {avatarOptions,type AvatarId} from '../shared/avatars'
import {arrivalSpot,benchSeats,sceneBins,scenes,type Pose,type SceneId} from '../shared/world'
import * as art from './pixelArt'
import * as street from './neighborhoodArt'
import {handUmbrellaArt} from './deckArt'
import {HeldDrinks,createDrinkTextures} from './heldDrink'
import {JEEPNEY_STOP,trafficAt} from '../shared/traffic'
import {isHeldDrink,type CafeAction,type HeldDrink} from '../shared/cafe'
import {MAX_VIEW_W,MIN_VIEW_W,BUBBLE_GAP,FADE_COLOR,FADE_MS,FONT,NAME_TAG_GAP,PX,TAG_FONT,Tag,addTexture,characterPhase,createReactionTextures,currentDaylight,drawRain,findPath,isHalloweenSeason,reactionTexture,setDepthIfChanged,slideDoor,tagDepth,tapSparks,visitorFrame,type BoardOrder,type Player,type WorldGame} from './common'

// Chits Neighborhood: the street outside the store. Loaded only when a visitor steps outside, as its own Phaser game.
export type NeighborhoodGame = WorldGame & {setPose:(id:string,pose:Pose,seat?:number)=>void;setBoard:(orders:BoardOrder[])=>void;vend:()=>void;goInside:()=>void;goToCafe:()=>void;setStoreOpen:(open:boolean)=>void;setCafeCount:(count:number)=>void;setRain:(on:boolean)=>void}
// from: the place the visitor just walked out of, so they appear (and the door closes) where they came out.
type Options = {nickname:string;avatar:AvatarId;onMove:(x:number,y:number)=>void;onInteract:(kind:string)=>void;onPose:(pose:Pose,seat?:number)=>void;onAct:(action:CafeAction)=>void;reducedMotion?:boolean;controlsEnabled?:boolean;zoom?:number;arriving?:boolean;from?:SceneId;daylight?:street.Daylight;viewWidth?:number;storeOpen?:boolean}
// lift: how far the art is drawn above the network position (sitting draws the visitor up on the seat).
type Visitor = {sprite:Phaser.GameObjects.Image;label:Tag;avatar:string;phase:number;movingUntil:number;bubble?:Tag|Phaser.GameObjects.Image;pose:Pose;seat?:number;sitSince:number;lift:number;umbrella?:Phaser.GameObjects.Image}

const {width:W,height:H,floor}=scenes.outside,CELL=20
const DOOR={x:360,y:206,standY:280,halfWidth:24,triggerY:272,pushMs:220}
// Kape & Chits, open 24/7 where Hugot Burger used to be. Its glass doors work like the store's.
const CAFE_DOOR={x:600,y:206,standY:280}
const CAFE_SIGN={x:652,y:276}
const CAFE_FRONT=new Phaser.Geom.Rectangle(504,80,192,176)
// Drawn lift of a seated visitor: from their floor spot in front of the bench up onto the seat.
const SEAT_LIFT=32,SIT_MS=220
const BENCH={x:120,y:282}
const VENDING={x:500,y:238,standX:500,standY:300}
const ORDER_BOARD={x:424,y:280,standX:420,standY:300}
const STORE_WINDOWS=[292,428]
// How far the scenery reaches past each end of the street, enough for the widest view.
const SIDE=(MAX_VIEW_W-W)/2
// Big pots just outside the walkable street, on both pavements. The road between them is open to traffic.
const ENDS=[{y:300,name:'big-pot'},{y:512,name:'big-pot'}]
// The road's two lanes (where a vehicle's wheels run): rightward traffic in the near lane, leftward in the far one.
const LANES={right:466,left:420}
// The jeepney stop's sign, on the near pavement beside where a waiting jeepney's rear door is.
const STOP_SIGN={x:322,y:500}
const pick=<T>(lines:readonly T[])=>lines[Math.floor(Math.random()*lines.length)]!
const SAKAY_LINES=['Sakay na! Tanaw, Tanaw!','Sakay na, may bakante pa!','Biyaheng probinsya! Sakay na!']
const LAMPS=[{x:210,y:298},{x:540,y:298},{x:250,y:472}]
const TREES=[{x:70,y:468},{x:650,y:468}]
// A closed neighbor, reserved for future expansion. Its bubble sits above the sign board, not over it.
const SHOPS=[
  {area:new Phaser.Geom.Rectangle(24,88,192,168),x:120,y:110,lines:['Coming soon! A sari-sari store is opening here.','Coming soon! Snacks and sundries, right next door.']},
]
const CAFE_SIGN_LINES=['Kape & Chits: free virtual kape, open 24/7. Pasok!','Tambay muna! Free kape inside, all day, all night.','Open for chill conversations. Pasok!']
const tambays=(count:number)=>`${count} ${count===1?'tambay':'tambays'} inside`
// A jack-o'-lantern by the door in the Halloween season, as inside.
const HALLOWEEN=isHalloweenSeason()
// Floor footprints: bench, vending machine, order board, door plant, the café sign, three lamp posts, two tree trunks, the planter.
const obstacles=[
  ...sceneBins.outside.map(bin=>({x:bin.x-12,y:bin.y-10,w:24,h:18})),
  {x:STOP_SIGN.x-6,y:STOP_SIGN.y-4,w:14,h:10},
  {x:84,y:262,w:72,h:32},{x:476,y:262,w:48,h:18},{x:398,y:262,w:52,h:34},{x:304,y:262,w:24,h:18},{x:632,y:266,w:40,h:36},
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
  private lastX:number
  private lastY:number
  private door?:Phaser.GameObjects.Image
  private cafeDoor?:Phaser.GameObjects.Image
  private neon?:{text:Phaser.GameObjects.Text;glow:Phaser.GameObjects.Image}
  // The door being walked through while the screen fades, so a refusal closes the right one.
  private exitDoor?:{door:Phaser.GameObjects.Image;prefix:string}
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
  // Drinks in visitors' hands, and the bin by the bench where they are thrown away.
  private drinks?:HeldDrinks
  // The vehicle going by now and then (see trafficAt), its headlight on the road after dark, and its honk.
  private vehicle?:Phaser.GameObjects.Image
  private headlight?:Phaser.GameObjects.Image
  private honk?:{tag:Tag;pass:number;until:number}
  // While a jeepney waits at the stop, its barker calls out; tapping the jeepney walks over and boards it.
  private sakay?:{tag:Tag;pass:number}
  private waitingJeepney?:Phaser.Geom.Rectangle
  private vendUntil=0
  private boardReady?:Phaser.GameObjects.Text
  private boardPrep?:Phaser.GameObjects.Text
  // One short notice at a time (closed shops, the locked door, a full bench). It stays where it appeared.
  private notice?:Tag
  private noticeTimer?:Phaser.Time.TimerEvent
  // While staff have the store closed: a CLOSED sign on the doors, the lights off, and the door stays locked.
  private storeOpen=true
  private closedSign?:Phaser.GameObjects.Container
  // How many are in Kape & Chits right now (a count from the server, never names), shown over its sidewalk sign.
  private cafeCount=0
  private cafeCountTag?:Tag
  // It rains on the street while Kape & Chits plays its rainy mood: a grey wash, rain, and an umbrella for everyone.
  private raining=false
  private rainWash?:Phaser.GameObjects.Rectangle
  private rainFx?:Phaser.GameObjects.Graphics
  private rainFrame=-2
  private lightsOff?:Phaser.GameObjects.Graphics
  constructor(opts:Options){super('Neighborhood');this.opts=opts;this.zoom=opts.zoom??1;({x:this.lastX,y:this.lastY}=this.start)}
  // Where the visitor appears: by the door they came out of.
  private get start(){return arrivalSpot('outside',this.opts.from)}
  private get fromCafe(){return Boolean(this.opts.arriving)&&this.opts.from==='cafe'}
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
    this.text(120,190,'COMING SOON',8,'#5e3d27',2)
    this.text(600,116,'KAPE & CHITS',10,'#fff3d6',LIT_DEPTH).setShadow(0,1,'#22392f',0,false,true)
    // OPEN 24/7 glows softly in the café's left window, day and night.
    const glow=this.sprite(542,186,'neon-glow',LIGHT_DEPTH).setBlendMode(Phaser.BlendModes.ADD)
    this.neon={glow,text:this.add.text(542,186,'OPEN\n24/7',{fontFamily:FONT,fontSize:'8px',color:'#ffb347',align:'center',lineSpacing:1,resolution:this.zoom}).setOrigin(.5).setDepth(LIT_DEPTH).setShadow(0,0,'#ff8a3d',4,false,true)}
    this.door=this.sprite(DOOR.x,DOOR.y,this.opts.arriving&&!this.fromCafe?'shop-door-3':'shop-door-0',1)
    this.cafeDoor=this.sprite(CAFE_DOOR.x,CAFE_DOOR.y,this.fromCafe?'cafe-door-3':'cafe-door-0',1)
    const cafeSign=this.floorSprite(CAFE_SIGN.x,CAFE_SIGN.y,'cafe-sign')
    this.text(CAFE_SIGN.x,CAFE_SIGN.y+11,'KAPE',8,'#fff6e2',cafeSign.depth+1)
    this.cafeCountTag=this.tag(CAFE_SIGN.x,CAFE_SIGN.y-32,tambays(0)).setDepth(cafeSign.depth+2).setVisible(false)
    // Darkened windows and door glass, and the sign, shown only while the store is closed.
    this.lightsOff=this.add.graphics().setDepth(1.5).fillStyle(0x2f2a33,.55)
    for(const x of STORE_WINDOWS)this.lightsOff.fillRect(x-36,146,72,76)
    this.lightsOff.fillRect(344,166,12,64).fillRect(364,166,12,64)
    this.closedSign=this.add.container(DOOR.x,184,[this.add.image(0,0,'closed-sign').setScale(PX),this.add.text(0,5,'CLOSED',{fontFamily:FONT,fontSize:'8px',color:'#ad513f',resolution:this.zoom}).setOrigin(.5)]).setDepth(1.6)
    this.setStoreOpen(this.opts.storeOpen!==false)
    this.floorSprite(BENCH.x,BENCH.y,'bench')
    this.vending=this.floorSprite(VENDING.x,VENDING.y,'vending-idle')
    this.drinks=new HeldDrinks(this,sceneBins.outside.map(bin=>this.floorSprite(bin.x,bin.y,'bin-idle')),()=>Boolean(this.opts.reducedMotion))
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
    this.rainWash=this.add.rectangle(-SIDE,0,W+SIDE*2,H,0x4f5b6b,.22).setOrigin(0).setDepth(SHADE_DEPTH-1).setVisible(false)
    this.rainFx=this.add.graphics().setDepth(LIT_DEPTH+1)
    for(const x of STORE_WINDOWS)this.windowGlows.push(this.sprite(x,184,'window-glow',LIGHT_DEPTH).setBlendMode(Phaser.BlendModes.ADD))
    for(const w of street.EDGE_WINDOWS)for(const x of [(w.x-street.EDGE.width)*PX,W+(street.EDGE.width-w.x)*PX])
      this.windowGlows.push(this.sprite(x,w.y*PX,'house-glow',LIGHT_DEPTH).setBlendMode(Phaser.BlendModes.ADD))
    for(const w of street.CAFE_FRONT_WINDOWS)this.windowGlows.push(this.sprite(w.x*PX,w.y*PX,'window-glow',LIGHT_DEPTH).setBlendMode(Phaser.BlendModes.ADD))
    this.lamps=LAMPS.map(({x,y})=>({post:this.floorSprite(x,y,'lamp-off'),x,y,flareUntil:0,
      glow:this.sprite(x,y-38,'lamp-glow',LIGHT_DEPTH).setBlendMode(Phaser.BlendModes.ADD),
      pool:this.sprite(x,y+50,'light-pool',LIGHT_DEPTH).setBlendMode(Phaser.BlendModes.ADD)}))
    this.vehicle=this.add.image(0,0,'car-0-0').setOrigin(.5,1).setScale(PX).setVisible(false)
    const stopSign=this.floorSprite(STOP_SIGN.x,STOP_SIGN.y-16,'jeepney-stop')
    this.text(STOP_SIGN.x,STOP_SIGN.y-37,'JEEP',8,'#fff8ea',stopSign.depth+1);this.text(STOP_SIGN.x,STOP_SIGN.y-29,'STOP',8,'#ffd45e',stopSign.depth+1)
    this.headlight=this.sprite(0,0,'light-pool',LIGHT_DEPTH).setBlendMode(Phaser.BlendModes.ADD).setVisible(false)
    this.moths=this.add.graphics().setDepth(LIT_DEPTH)
    this.applyDaylight()
    this.time.addEvent({delay:60_000,loop:true,callback:()=>{const next=this.opts.daylight??currentDaylight();if(next!==this.daylight){this.daylight=next;this.applyDaylight()}}})
    const avatar=this.textures.exists(this.opts.avatar)?this.opts.avatar:'mochi'
    const start=this.start
    const sprite=this.sprite(start.x,start.y,avatar,start.y+10)
    this.self={sprite,label:this.tag(start.x,start.y-NAME_TAG_GAP,this.opts.nickname).setDepth(tagDepth(start.y)),avatar,phase:characterPhase(this.opts.nickname),movingUntil:0,pose:'stand',sitSince:0,lift:0}
    this.fitCamera(this.opts.viewWidth??MIN_VIEW_W)
    camera.centerOn(start.x,H/2).startFollow(sprite,true,this.opts.reducedMotion?1:.12,1)
    // Stepping out of the store or the café: fade in while the doors slide shut behind the visitor.
    if(this.opts.arriving){
      if(!this.opts.reducedMotion)camera.fadeIn(FADE_MS,...FADE_COLOR)
      if(this.opts.from==='jeepney')this.jeepneyLeaves()
      else{
        const [door,prefix]=this.fromCafe?[this.cafeDoor,'cafe-door']:[this.door,'shop-door']
        this.time.delayedCall(this.opts.reducedMotion?0:450,()=>{if(door)slideDoor(this,door,prefix,false,Boolean(this.opts.reducedMotion))})
      }
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
    for(const kind of ['car','jeepney','tricycle'] as const)for(let paint=0;paint<4;paint++)for(const frame of [0,1] as const)texture(`${kind}-${paint}-${frame}`,street.vehicleArt(kind,paint,frame))
    texture('big-pot',street.bigPotArt());texture('jeepney-stop',street.jeepneyStopArt());texture('house-glow',street.glowArt(16,'#ffcf7a'))
    for(const time of ['day','dusk','night'] as const)texture(`sky-${time}`,street.skyArt(time))
    texture('cloud',street.cloudArt())
    for(const option of avatarOptions){
      const id=option.id
      texture(id,art.visitorArt(id,'idle'));texture(`${id}-blink`,art.visitorArt(id,'blink'))
      texture(`${id}-step1`,art.visitorArt(id,'step1'));texture(`${id}-step2`,art.visitorArt(id,'step2'))
      texture(`${id}-sit`,street.sittingVisitorArt(id));texture(`${id}-sit-blink`,street.sittingVisitorArt(id,true))
    }
    for(const frame of [0,1,2,3] as const){texture(`shop-door-${frame}`,street.storeDoorArt(frame));texture(`cafe-door-${frame}`,street.cafeDoorArt(frame))}
    texture('cafe-sign',street.cafeSignArt());texture('hand-umbrella',handUmbrellaArt());texture('neon-glow',street.glowArt(16,'#ffb347'))
    texture('bench',street.benchArt());createDrinkTextures(this)
    for(const frame of ['idle','blink','vend'] as const)texture(`vending-${frame}`,street.vendingArt(frame))
    texture('order-board',street.orderBoardArt())
    texture('lamp-off',street.lampArt(false));texture('lamp-on',street.lampArt(true))
    texture('lamp-glow',street.glowArt(18,'#ffd98a'));texture('window-glow',street.glowArt(22,'#ffcf7a'));texture('light-pool',street.lightPoolArt())
    texture('tree-0',street.treeArt(0));texture('tree-1',street.treeArt(1))
    texture('planter',street.planterArt());texture('closed-sign',street.closedSignArt());texture('leaf',street.leafArt());texture('can',street.canArt())
    texture('plant-small',art.smallPlantArt());texture('sparkle',art.sparkleArt());texture('head-palitaw',art.headArt('palitaw'))
    if(HALLOWEEN)texture('pumpkin-glow',art.pumpkinArt('glow'))
    createReactionTextures(this)
  }
  private applyDaylight(){
    const {color,alpha}=SHADE[this.daylight]
    this.sky?.setTexture(`sky-${this.daylight}`)
    for(const cloud of this.clouds)cloud.setVisible(this.daylight!=='night').setAlpha(this.daylight==='dusk'?.75:1)
    this.shade?.setFillStyle(color,alpha).setVisible(alpha>0)
    // The store's own two windows stay dark at night while it is closed; the houses' windows still glow.
    this.windowGlows.forEach((glow,i)=>glow.setVisible(this.daylight!=='day'&&(this.storeOpen||i>=STORE_WINDOWS.length)))
  }
  private tap(x:number,y:number){
    if(this.inputBlocked())return
    const spark=()=>{if(!this.opts.reducedMotion)tapSparks(this,x,y)}
    const interact=(tx:number,ty:number,kind:string)=>{spark();this.walkTo(tx,ty,()=>this.opts.onInteract(kind))}
    if(Math.abs(x-DOOR.x)<=22&&y>=156&&y<=256){spark();this.walkTo(DOOR.x,DOOR.standY,()=>this.enterStore());return}
    if(Math.abs(x-CAFE_DOOR.x)<=22&&y>=156&&y<=256){spark();this.goToCafe();return}
    if(Math.abs(x-CAFE_SIGN.x)<=26&&y>=244&&y<=308){
      const lines=this.cafeCount?[`${tambays(this.cafeCount)}. Pasok!`,'May tambay dito! Free kape inside.']:CAFE_SIGN_LINES
      spark();this.noticeAt(CAFE_SIGN.x,CAFE_SIGN.y-36,lines[Math.floor(Math.random()*lines.length)]!,3200,140);return
    }
    // Tapping the café front (not the door) walks over to its door.
    if(CAFE_FRONT.contains(x,y)){spark();this.walkTo(CAFE_DOOR.x,CAFE_DOOR.standY);return}
    // A jeepney waiting at the stop: walk to its rear door and get on. The sign says what it's for.
    if(this.waitingJeepney?.contains(x,y)){interact(JEEPNEY_STOP.boardX,JEEPNEY_STOP.boardY,'jeepney');return}
    if(Math.abs(x-STOP_SIGN.x)<=16&&y>=STOP_SIGN.y-56&&y<=STOP_SIGN.y+6){spark();this.noticeAt(STOP_SIGN.x,STOP_SIGN.y-66,'Jeepney stop! Tap the jeep when it stops here to ride.',3200,150);return}
    if(Math.abs(x-VENDING.x)<=24&&y>=196&&y<=284){interact(VENDING.standX,VENDING.standY,'vending');return}
    const bin=sceneBins.outside.find(b=>Math.abs(x-b.x)<=18&&y>=b.y-26&&y<=b.y+16)
    if(bin){interact(bin.standX,bin.standY,'trash');return}
    if(Math.abs(x-BENCH.x)<=36&&y>=256&&y<=302){spark();this.chooseSeat(x);return}
    if(Math.abs(x-ORDER_BOARD.x)<=28&&y>=252&&y<=306){interact(ORDER_BOARD.standX,ORDER_BOARD.standY,'board');return}
    const lamp=this.lamps.find(lamp=>Math.abs(x-lamp.x)<=14&&y>=lamp.y-50&&y<=lamp.y+50)
    if(lamp){spark();lamp.flareUntil=this.time.now+1400;return}
    const tree=this.trees.find(({sprite})=>Math.abs(x-sprite.x)<=40&&y>=sprite.y-50&&y<=sprite.y+30)
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
  private noticeAt(x:number,y:number,text:string,ms:number,wrap=150){
    this.noticeTimer?.remove(false);this.notice?.destroy()
    const bubble=this.tag(x,y,text,TAG_FONT,wrap).setDepth(900)
    this.notice=bubble
    this.noticeTimer=this.time.delayedCall(ms,()=>{if(this.notice===bubble)this.notice=undefined;bubble.destroy();this.noticeTimer=undefined})
  }
  // A quick line just above where the visitor is standing (e.g. the bench is full); it doesn't follow them.
  private say(text:string){
    const self=this.self
    if(self)this.noticeAt(self.sprite.x,self.sprite.y-self.lift-BUBBLE_GAP,text,2200,140)
  }
  private shopSpeak(shop:typeof SHOPS[number]){this.noticeAt(shop.x,shop.y,shop.lines[Math.floor(Math.random()*shop.lines.length)]!,3200)}
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
    this.walkTo(DOOR.x,DOOR.standY,()=>this.enterStore())
    if(!this.inputBlocked()&&!this.path.length&&this.afterPath){this.afterPath=undefined;this.enterStore()}
  }
  // The page's café button, or a tap on the café door: walk over and go in. The café never closes.
  goToCafe(){
    const enter=()=>this.opts.onInteract('cafe')
    this.walkTo(CAFE_DOOR.x,CAFE_DOOR.standY,enter)
    if(!this.inputBlocked()&&!this.path.length&&this.afterPath){this.afterPath=undefined;enter()}
  }
  // At the door: in we go, unless the store is closed, when the locked door rattles and the visitor says so.
  private enterStore(){
    if(this.storeOpen){this.opts.onInteract('store');return}
    // The closed store answers from its door, above the CLOSED sign.
    this.noticeAt(DOOR.x,162,"Sorry, we're closed! Come back soon.",2600)
    const door=this.door
    if(!door||this.opts.reducedMotion)return
    this.tweens.killTweensOf(door);door.setX(DOOR.x)
    this.tweens.add({targets:door,x:DOOR.x+PX/2,duration:50,yoyo:true,repeat:3,onComplete:()=>door.setX(DOOR.x)})
  }
  setCafeCount(count:number){
    this.cafeCount=Math.max(0,Math.floor(count))
    this.cafeCountTag?.setVisible(this.cafeCount>0)
    if(this.cafeCount&&this.cafeCountTag?.text!==tambays(this.cafeCount))this.cafeCountTag?.setText(tambays(this.cafeCount))
  }
  setStoreOpen(open:boolean){
    this.storeOpen=open
    this.closedSign?.setVisible(!open);this.lightsOff?.setVisible(!open)
    this.applyDaylight()
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
    if(this.raining&&!visitor.umbrella)visitor.umbrella=this.sprite(0,0,'hand-umbrella',0).setOrigin(.5,0)
    const umbrella=visitor.umbrella
    if(umbrella){
      if(umbrella.visible!==this.raining)umbrella.setVisible(this.raining)
      if(this.raining){if(umbrella.x!==sprite.x+3||umbrella.y!==top-30)umbrella.setPosition(sprite.x+3,top-30);setDepthIfChanged(umbrella,sprite.depth+.6);umbrella.setAlpha(sprite.alpha)}
    }
  }
  // A vehicle drives along its lane when the clock says one is passing (never with reduced motion). It honks at a
  // visitor standing in its way; after dark its headlight lights the road ahead.
  private updateTraffic(){
    const vehicle=this.vehicle,light=this.headlight
    if(!vehicle||!light)return
    // With reduced motion only a jeepney already waiting at the stop shows (standing still), so it can still be boarded.
    const live=trafficAt(Date.now()),pass=this.opts.reducedMotion&&!live?.stopped?undefined:live
    this.waitingJeepney=undefined
    if(!pass){if(vehicle.visible){vehicle.setVisible(false);light.setVisible(false)}this.honk?.tag.setVisible(false);this.sakay?.tag.setVisible(false);return}
    const ahead=pass.rightward?1:-1,x=Math.round(pass.x/PX)*PX,y=pass.rightward?LANES.right:LANES.left
    const texture=`${pass.kind}-${pass.paint}-${pass.stopped?0:Math.floor(this.time.now/110)%2}`
    if(vehicle.texture.key!==texture)vehicle.setTexture(texture)
    vehicle.setPosition(x,y).setFlipX(!pass.rightward).setDepth(y+10).setVisible(true)
    const lamps=SHADE[this.daylight].lamps
    light.setVisible(lamps>0).setAlpha(lamps).setPosition(x+ahead*(vehicle.displayWidth/2+36),y-4)
    const self=this.self?.sprite,now=this.time.now
    if(self&&!pass.stopped&&this.honk?.pass!==pass.id&&Math.abs(self.y-(y-10))<30&&(self.x-x)*ahead>0&&(self.x-x)*ahead<160){
      this.honk?.tag.destroy()
      this.honk={tag:this.tag(x,y-vehicle.displayHeight-30,'Beep beep!').setDepth(900),pass:pass.id,until:now+1600}
    }
    if(pass.stopped){
      this.waitingJeepney=new Phaser.Geom.Rectangle(x-vehicle.displayWidth/2,y-vehicle.displayHeight,vehicle.displayWidth,vehicle.displayHeight)
      if(this.sakay?.pass!==pass.id){this.sakay?.tag.destroy();this.sakay={tag:this.tag(x,y-vehicle.displayHeight-6,pick(SAKAY_LINES)).setDepth(900),pass:pass.id}}
      this.sakay.tag.setVisible(true)
    }else this.sakay?.tag.setVisible(false)
    const honk=this.honk
    if(honk){
      const showing=honk.pass===pass.id&&now<honk.until
      honk.tag.setVisible(showing)
      if(showing)honk.tag.setPosition(x,y-vehicle.displayHeight-30)
    }
  }
  setRain(on:boolean){
    if(this.raining===on)return
    this.raining=on;this.rainFrame=-2;this.rainWash?.setVisible(on)
    for(const visitor of [this.self,...this.remotes.values()])if(visitor)this.placeTags(visitor)
  }
  private updateRain(){
    const fx=this.rainFx,motion=!this.opts.reducedMotion
    if(!fx)return
    const frame=!this.raining?-3:motion?Math.floor(this.time.now/90):-1
    if(frame===this.rainFrame)return
    this.rainFrame=frame
    if(frame===-3){fx.clear();return}
    drawRain(fx,{x:-SIDE,y:0,width:W+SIDE*2,height:H},250,frame)
  }
  // Lamps glow by evening and pulse very slightly; moths circle the lit heads at night. Redrawn only on a new frame.
  private updateAmbient(){
    this.updateRain()
    this.drinks?.update()
    this.updateTraffic()
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
    // The OPEN sign hums: a slow, slight glow pulse, and now and then a quick dim.
    if(this.neon){
      const dim=motion&&now%9000<90,alpha=dim?.55:motion?.85+Math.round(Math.sin(now/700)*2)/20:1
      if(this.neon.text.alpha!==alpha){this.neon.text.setAlpha(alpha);this.neon.glow.setAlpha(dim?.4:alpha)}
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
  // Holding up (keys or joystick) against the store or café door for a moment walks in.
  private checkDoorPush(pushY:number,delta:number){
    const sprite=this.self!.sprite
    if(sprite.y>DOOR.triggerY+16)this.doorTriggered=false
    const at=(x:number)=>pushY<-.5&&sprite.y<=DOOR.triggerY&&Math.abs(sprite.x-x)<=DOOR.halfWidth
    const door=at(DOOR.x)?'store':at(CAFE_DOOR.x)?'cafe':undefined
    this.doorPush=door?this.doorPush+delta:0
    if(door&&this.doorPush>=DOOR.pushMs&&!this.doorTriggered&&this.time.now>=this.doorReadyAt){this.doorTriggered=true;if(door==='store')this.enterStore();else this.opts.onInteract('cafe')}
  }
  exitScene(target?:SceneId){
    if(target==='jeepney')return this.boardJeepney()
    return new Promise<void>(resolve=>{
      const self=this.self,exit=target==='cafe'?{door:this.cafeDoor,prefix:'cafe-door'}:{door:this.door,prefix:'shop-door'}
      if(!self||!exit.door){resolve();return}
      this.exitDoor={door:exit.door,prefix:exit.prefix}
      this.standUp(false)
      this.exiting={x:self.sprite.x,y:self.sprite.y};this.resetMovement();this.doorTriggered=true
      const instant=Boolean(this.opts.reducedMotion)
      slideDoor(this,exit.door,exit.prefix,true,instant,()=>{
        if(instant){resolve();return}
        // Step in through the door while the screen fades.
        this.tweens.add({targets:self.sprite,y:self.sprite.y-16,alpha:0,duration:FADE_MS,onUpdate:()=>{self.label.setPosition(self.sprite.x,self.sprite.y-NAME_TAG_GAP).setAlpha(self.sprite.alpha);self.umbrella?.setPosition(self.sprite.x+3,self.sprite.y-self.lift-30).setAlpha(self.sprite.alpha)}})
        this.cameras.main.fade(FADE_MS,...FADE_COLOR,true,(_:unknown,progress:number)=>{if(progress>=1)resolve()})
      })
    })
  }
  // Climbing in at the jeepney's rear door while the screen fades.
  private boardJeepney(){
    return new Promise<void>(resolve=>{
      const self=this.self
      if(!self){resolve();return}
      this.standUp(false)
      this.exiting={x:self.sprite.x,y:self.sprite.y};this.resetMovement()
      if(this.opts.reducedMotion){resolve();return}
      this.tweens.add({targets:self.sprite,x:JEEPNEY_STOP.x-88,y:LANES.right-14,alpha:0,duration:FADE_MS+120,onUpdate:()=>this.placeTags(self)})
      self.label.setAlpha(0)
      this.cameras.main.fade(FADE_MS,...FADE_COLOR,true,(_:unknown,progress:number)=>{if(progress>=1)resolve()})
    })
  }
  // Just off a jeepney in front of the store: it pulls away from the stop (unless the real traffic has one there now).
  private jeepneyLeaves(){
    if(this.opts.reducedMotion||trafficAt(Date.now())?.kind==='jeepney')return
    const jeep=this.add.image(JEEPNEY_STOP.x,LANES.right,`jeepney-${Math.floor(Math.random()*4)}-0`).setOrigin(.5,1).setScale(PX).setDepth(LANES.right+10)
    const wheels=this.time.addEvent({delay:110,loop:true,callback:()=>jeep.setTexture(jeep.texture.key.replace(/-(\d)$/,(_,f)=>`-${f==='0'?1:0}`))})
    this.tweens.add({targets:jeep,x:W+SIDE+120,duration:3600,ease:'Quad.easeIn',delay:300,onComplete:()=>{wheels.remove();jeep.destroy()}})
  }
  cancelExit(){
    const from=this.exiting,self=this.self
    this.exiting=undefined;this.doorPush=0;this.doorReadyAt=this.time.now+1200
    if(from&&self){this.tweens.killTweensOf(self.sprite);self.sprite.setPosition(from.x,from.y).setAlpha(1);self.label.setAlpha(1);self.umbrella?.setAlpha(1);this.placeTags(self)}
    if(this.opts.reducedMotion)this.cameras.main.resetFX();else this.cameras.main.fadeEffect.start(false,FADE_MS,...FADE_COLOR,true)
    const exit=this.exitDoor;this.exitDoor=undefined
    if(exit)slideDoor(this,exit.door,exit.prefix,false,Boolean(this.opts.reducedMotion))
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
    // A visitor can change their name mid-visit (see /api/me/nickname); the next list carries it to every name tag.
    for(const p of players){const visitor=p.id===selfId?this.self:this.remotes.get(p.id);if(visitor&&visitor.label.text!==p.nickname){visitor.label.setText(p.nickname);}}
    const incoming=new Set(players.filter(p=>p.id!==selfId).map(p=>p.id))
    for(const [id,p] of this.remotes)if(!incoming.has(id)){p.sprite.destroy();p.label.destroy();p.bubble?.destroy();p.umbrella?.destroy();this.drinks?.remove(p.sprite);this.remotes.delete(id)}
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
    for(const p of players){const visitor=p.id===selfId?this.self:this.remotes.get(p.id);if(visitor)this.drinks?.set(visitor.sprite,isHeldDrink(p.drink)?p.drink:null)}
  }
  // A new can from the machine lands in the hand once it has dropped into the tray; a drink let go goes in the bin.
  setDrink(id:string,drink:HeldDrink|null){
    const visitor=id===this.selfId?this.self:this.remotes.get(id)
    if(!visitor)return
    const wait=id===this.selfId&&drink?this.vendUntil-600-this.time.now:0
    if(wait>0)this.time.delayedCall(wait,()=>this.drinks?.set(visitor.sprite,drink));else this.drinks?.set(visitor.sprite,drink)
  }
  playAction(id:string,action:CafeAction){const remote=this.remotes.get(id);if(remote&&action==='sip')this.drinks?.sip(remote.sprite)}
  sip(){
    if(!this.self||!this.drinks?.sip(this.self.sprite))return false
    this.opts.onAct('sip')
    return true
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
    exitScene:target=>active()?scene.exitScene(target):Promise.resolve(),cancelExit:()=>{if(active())scene.cancelExit()},setViewWidth:width=>scene.setViewWidth(width),
    setPose:(id,pose,seat)=>{if(active())scene.setPose(id,pose,seat)},setBoard:orders=>{if(active())scene.setBoard(orders)},vend:()=>{if(active())scene.vend()},goInside:()=>{if(active())scene.goInside()},goToCafe:()=>{if(active())scene.goToCafe()},setStoreOpen:open=>{if(active())scene.setStoreOpen(open)},setCafeCount:count=>{if(active())scene.setCafeCount(count)},setRain:on=>{if(active())scene.setRain(on)},
    setDrink:(id,drink)=>{if(active())scene.setDrink(id,drink)},playAction:(id,action)=>{if(active())scene.playAction(id,action)},sip:()=>active()&&scene.sip()}
}
