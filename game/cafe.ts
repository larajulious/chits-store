import Phaser from 'phaser'
import {avatarOptions,type AvatarId} from '../shared/avatars'
import {CAFE_RESTROOM_SEAT,RESTROOM_MS,cafeSeats,sceneBins,scenes,type Pose} from '../shared/world'
import {binNear,createDrinkTextures,tossIntoBin} from './heldDrink'
import {HOLDING_ALREADY,drinkOptions,isHeldDrink,type CafeAction,type CafeMood,type DrinkId,type HeldDrink} from '../shared/cafe'
import * as art from './pixelArt'
import * as cafe from './cafeArt'
import * as deck from './deckArt'
import {bigPotArt,glowArt,sittingVisitorArt} from './neighborhoodArt'
import {DECK_BENCHES,DECK_LEFT,RAIL_Y,TanawView,createDeckTextures,deckObstacles} from './tanawView'
import {BUBBLE_GAP,FADE_COLOR,FADE_MS,FONT,MIN_VIEW_W,NAME_TAG_GAP,PX,TAG_FONT,Tag,addTexture,characterPhase,createReactionTextures,currentDaylight,drawRain,findPath,reactionTexture,setDepthIfChanged,slideDoor,tagDepth,tapSparks,visitorFrame,type Daylight,type Player,type WorldGame} from './common'

// Kape & Chits: the 24/7 coffee tambayan next to the store, its own Phaser game like the street.
// Everyone inside shares one room, the café and the Tanaw Deck beside it: positions, seats, drinks and actions come through the server.
export type CafeGame = WorldGame & {setPose:(id:string,pose:Pose,seat?:number)=>void;
  orderDrink:(drink:DrinkId,surprise?:boolean)=>void;act:(action:CafeAction)=>void;standUp:()=>void;setMusic:(mood:CafeMood|null)=>void;enjoyView:()=>void}
// skyMinute: a fixed time of day for the deck's sky (the page's ?time= preview); otherwise the store's Manila clock.
type Options = {nickname:string;avatar:AvatarId;onMove:(x:number,y:number)=>void;onInteract:(kind:string)=>void;onPose:(pose:Pose,seat?:number)=>void;
  onDrink:(drink:DrinkId)=>void;onAct:(action:CafeAction)=>void;reducedMotion?:boolean;controlsEnabled?:boolean;zoom?:number;arriving?:boolean;daylight?:Daylight;skyMinute?:number;viewWidth?:number}
// lift: how far the art is drawn above the network position. The *Until times drive short, local animations.
type Visitor = {sprite:Phaser.GameObjects.Image;label:Tag;avatar:string;name:string;phase:number;movingUntil:number;bubble?:Tag|Phaser.GameObjects.Image;pose:Pose;seat?:number;sitSince:number;lift:number;
  drink?:HeldDrink;cup?:Phaser.GameObjects.Image;umbrella?:Phaser.GameObjects.Image;sipUntil:number;
  // 0..1: how far into the CR (out of sight) the visitor is.
  hidden:number;relaxUntil:number;laughUntil:number;waveUntil:number}

const {width:W,height:H,floor,spawn}=scenes.cafe,CELL=20
const DOOR={x:180,standY:540,halfWidth:46,pushMs:220,triggerY:536}
const SIT_MS=220
// Seats (see cafeSeats): chairs behind the three café tables and the deck's table, the sofa, the deck benches and
// the railing spots. lift draws the visitor up onto the seat; back seats show the visitor from behind, facing the view.
type SeatKind='chair'|'sofa'|'bench'|'rail'|'restroom'
const TABLES=[{x:100,y:364,variant:0},{x:100,y:464,variant:1},{x:240,y:404,variant:2},{x:540,y:504,variant:1}] as const
const seatLayout=(i:number):{kind:SeatKind;table?:number}=>i<6?{kind:'chair',table:Math.floor(i/2)}:i<8?{kind:'sofa'}:i<12?{kind:'bench'}:i<14?{kind:'chair',table:3}:i<CAFE_RESTROOM_SEAT?{kind:'rail'}:{kind:'restroom'}
const LIFT:Record<SeatKind,number>={chair:24,sofa:32,bench:22,rail:0,restroom:0}
const SEATS=cafeSeats.map((spot,i)=>{const layout=seatLayout(i);return {...spot,...layout,lift:LIFT[layout.kind],back:layout.kind==='bench'||layout.kind==='rail'}})
const seatsOf=(kind:SeatKind)=>SEATS.flatMap((seat,i)=>seat.kind===kind?[i]:[])
const RAIL_SEATS=seatsOf('rail'),BENCH_SEATS=seatsOf('bench')
const SOFA={x:280,y:254,area:new Phaser.Geom.Rectangle(224,228,112,56)}
const COUNTER={x:12,y:180,area:new Phaser.Geom.Rectangle(12,86,192,176)}
const BARISTA={x:112,y:184,standX:120,standY:280}
const ESPRESSO={x:64,y:190}
const BOARD={area:new Phaser.Geom.Rectangle(290,88,64,92),standX:320,standY:300}
const WINDOW_AREA=new Phaser.Geom.Rectangle(cafe.CAFE_WINDOW_GLASS.x*PX-6,cafe.CAFE_WINDOW_GLASS.y*PX-6,cafe.CAFE_WINDOW_GLASS.w*PX+12,cafe.CAFE_WINDOW_GLASS.h*PX+16)
const JUKEBOX={x:322,y:486,standX:280,standY:500}
const PLANT={x:36,y:516}
// The CR's door in the front wall, left of the entrance; its spot on the floor is seat CAFE_RESTROOM_SEAT.
const CR={x:80,y:564,area:new Phaser.Geom.Rectangle(42,538,76,42)}
const CR_LINES=['Ahh, ginhawa!','Ayan, okay na.','Balik tambay!','Hugas kamay, check!']
// The Tanaw Deck beside the café (see tanawView.ts): its doorway in the wall, and the benches' seats.
const DOORWAY={top:372,bottom:452}
const BENCHES=DECK_BENCHES.map((x,i)=>({x,seats:[8+i*2,9+i*2]}))
// In the rainy mood, patio umbrellas open over each bench and the deck's table (TABLES[DECK_TABLE]).
const DECK_TABLE=3,PATIO_UMBRELLAS=[...BENCHES.map(b=>({x:b.x,y:392})),{x:540,y:496}]
// Footprints: tables, sofa, jukebox, plant; the café/deck wall (open at the doorway), the railing, the benches, the deck's
// pots, and the two garbage bins (one by the jukebox, one on the deck).
const obstacles=[
  ...TABLES.map(t=>({x:t.x-36,y:t.y+8,w:72,h:24})),
  {x:224,y:256,w:112,h:16},{x:300,y:490,w:44,h:28},{x:20,y:504,w:34,h:30},
  ...deckObstacles(DOORWAY),
  ...sceneBins.cafe.map(bin=>({x:bin.x-12,y:bin.y-10,w:24,h:18})),
].map(box=>new Phaser.Geom.Rectangle(box.x,box.y,box.w,box.h))
function bounded(x:number,y:number){return x>=floor.minX&&x<=floor.maxX&&y>=floor.minY&&y<=floor.maxY&&!obstacles.some(r=>r.contains(x,y))}
function nearestOpen(x:number,y:number){
  const cx=Math.round(Math.max(floor.minX,Math.min(floor.maxX,x))/CELL),cy=Math.round(Math.max(floor.minY,Math.min(floor.maxY,y))/CELL)
  for(let ring=0;ring<=4;ring++)for(let dy=-ring;dy<=ring;dy++)for(let dx=-ring;dx<=ring;dx++){
    if(Math.max(Math.abs(dx),Math.abs(dy))!==ring)continue
    const px=(cx+dx)*CELL,py=(cy+dy)*CELL
    if(bounded(px,py))return {x:px,y:py}
  }
}
function pathFind(start:Phaser.Math.Vector2,target:Phaser.Math.Vector2){return findPath(start,target,bounded,CELL)}
const pick=<T>(lines:readonly T[])=>lines[Math.floor(Math.random()*lines.length)]!
const shortName=(name:string)=>name.length>12?`${name.slice(0,11).trimEnd()}…`:name
// The barista chats now and then, greets newcomers by name, and answers taps.
const BARISTA_IDLE_LINES=['Fresh brew, libre lahat!','Tambay lang, walang bayad!','Kape muna bago lahat.','Need a refill? Tap me!','Upo ka muna, relax lang.','Try the chika board for kwentuhan!','Music? Tap the jukebox!','Open kami 24/7, promise!','Silipin mo ang view sa deck!','Dalhin mo ang kape mo sa deck!','May CR kami sa harap, katabi ng pinto.']
const BARISTA_WELCOME=['Pasok po! Welcome sa Kape & Chits!','Uy, welcome! Kape tayo?']
const BARISTA_HELLO=['Welcome, {name}!','Hi {name}! Kape?','Uy {name}, upo ka!']
const BARISTA_NEAR=['Hi! Tap me for a free kape.','Kape? Libre lang!']
const WINDOW_LINES:Record<Daylight,string[]>={day:['Ang ganda ng araw!','Sunny outside. Iced coffee weather!'],dusk:['Ang ganda ng sunset...','Golden hour na!'],night:['Gabi na, pero bukas pa kami!','Ang tahimik ng gabi.']}
const HOT_DRINKS=new Set<HeldDrink>(['hot-latte','cappuccino','hot-chocolate'])
// Lights and window: added light depth, below name tags; the window paints just above the room art.
const LIGHT_DEPTH=592,BULB_GLOW:Record<Daylight,number>={day:.35,dusk:.7,night:.95}
class CafeScene extends Phaser.Scene{
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
  private doorLight?:Phaser.GameObjects.Graphics
  private doorPush=0
  private doorTriggered=false
  private doorReadyAt=0
  private exiting?:{x:number;y:number}
  private daylight:Daylight='day'
  private windowSky?:Phaser.GameObjects.Graphics
  private windowFx?:Phaser.GameObjects.Graphics
  private windowFrame=-2
  private bulbs:Phaser.GameObjects.Image[]=[]
  private barista?:Phaser.GameObjects.Image
  private baristaMode:'idle'|'wave'|'brew'|'serve'='idle'
  private baristaUntil=0
  private baristaBubble?:Tag
  private baristaBubbleTimer?:Phaser.Time.TimerEvent
  private baristaNextLineAt=0
  private baristaGreetedAt=-Infinity
  private servingCup?:Phaser.GameObjects.Image
  private espresso?:Phaser.GameObjects.Image
  private steam?:Phaser.GameObjects.Graphics
  private steamFrame=-2
  private jukebox?:Phaser.GameObjects.Image
  private notes:Phaser.GameObjects.Image[]=[]
  // The café jukebox's current mood (shared by everyone inside), which also sets the weather.
  private music:CafeMood|null=null
  private notice?:Tag
  private noticeTimer?:Phaser.Time.TimerEvent
  private hasPlayers=false
  private patioUmbrellas:Phaser.GameObjects.Image[]=[]
  private crDoor?:Phaser.GameObjects.Image
  private bins:Phaser.GameObjects.Image[]=[]
  // The view beside the café (sky, mountains, lights; see tanawView.ts), and whether this visitor is out on the deck.
  private view?:TanawView
  private onDeck=false
  private nextViewThought=0
  constructor(opts:Options){super('Cafe');this.opts=opts;this.zoom=opts.zoom??1}
  private sprite(x:number,y:number,name:string,depth:number){return this.add.image(x,y,name).setScale(PX).setDepth(depth)}
  private floorSprite(x:number,y:number,name:string){const image=this.sprite(x,y,name,0);image.setDepth(y+image.displayHeight/2-14);return image}
  private text(x:number,y:number,value:string,size:number,color:string,depth:number){
    return this.add.text(x,y,value,{fontFamily:FONT,fontSize:`${size}px`,color,resolution:this.zoom}).setOrigin(.5).setDepth(depth)
  }
  private tag(x:number,y:number,value:string,size=TAG_FONT,wrap?:number){return new Tag(this,x,y,value,{size,wrap,resolution:this.zoom})}
  create(){
    const camera=this.cameras.main
    camera.setZoom(this.zoom).setBackgroundColor('#6e4a31')
    this.createTextures()
    this.add.image(0,0,'cafe-room').setOrigin(0).setScale(PX).setDepth(0)
    // Wider screens see brick past the café's left wall, as in the store; on the right, the view goes on.
    this.add.image(-720,0,'brick-wall').setOrigin(0).setScale(PX).setDepth(0)
    this.add.graphics().setDepth(0).fillStyle(0x2b1d16,.35).fillRect(-PX*2,0,PX*2,H)
    this.createDeck()
    this.daylight=this.opts.daylight??currentDaylight()
    this.windowSky=this.add.graphics().setDepth(.5)
    this.windowFx=this.add.graphics().setDepth(.6)
    this.time.addEvent({delay:60_000,loop:true,callback:()=>{const next=this.opts.daylight??currentDaylight();if(next!==this.daylight){this.daylight=next;this.drawWindowSky()}}})
    this.text(180,30,'KAPE & CHITS',14,'#fff3d6',2).setStroke('#fff3d6',1).setShadow(0,2,'#22392f',0,false,true)
    this.text(180,52,'24/7 COFFEE TAMBAYAN',8,'#d8e8c4',2)
    this.text(56,101,'KAPE MENU',8,'#fff6e2',2).setShadow(0,1,'#0b1a13',0,false,true)
    this.text(322,171,'CHIKA',8,'#fff0d2',2)
    this.bulbs=cafe.CAFE_BULBS.map(bulb=>this.sprite(bulb.x*PX,bulb.y*PX,'bulb-glow',LIGHT_DEPTH).setBlendMode(Phaser.BlendModes.ADD))
    // Counter, machine and barista. The barista stands between the back shelves and the counter, which hides their legs.
    this.barista=this.sprite(BARISTA.x,BARISTA.y,'barista-idle',150)
    this.add.image(COUNTER.x,COUNTER.y,'cafe-counter').setOrigin(0).setScale(PX).setDepth(200)
    this.espresso=this.sprite(ESPRESSO.x,ESPRESSO.y,'espresso-idle',205)
    this.steam=this.add.graphics().setDepth(206)
    this.text(BARISTA.x+8,240,'FREE KAPE',8,'#fff0d2',201)
    // Lounge, tables and chairs. Chairs sit behind their table; whoever sits there is drawn between the two.
    this.sprite(SOFA.x,SOFA.y,'sofa',270)
    SEATS.forEach(seat=>{if(seat.table!==undefined)this.sprite(seat.x,seat.y-12,'cafe-chair',seat.y-1)})
    TABLES.forEach(table=>this.sprite(table.x,table.y,`cafe-table-${table.variant}`,table.y+20))
    this.floorSprite(PLANT.x,PLANT.y,'big-pot')
    this.bins=sceneBins.cafe.map(bin=>this.floorSprite(bin.x,bin.y,'bin-idle'))
    this.sprite(212,250,'plant-small',262)
    this.jukebox=this.floorSprite(JUKEBOX.x,JUKEBOX.y,'jukebox-idle')
    this.notes=[0,1,2].map(()=>this.sprite(JUKEBOX.x,JUKEBOX.y,'music-note',640).setVisible(false))
    // The front door onto the street, as in the store.
    this.sprite(180,564,'entrance',1000)
    this.crDoor=this.sprite(CR.x,CR.y,'cr-closed-free',1000)
    this.text(CR.x-4,CR.y-7,'CR',8,'#5e3d27',1001)
    this.text(180,559,'GO OUTSIDE',8,'#5e3d27',1001)
    this.doorLight=this.add.graphics().setDepth(1001).setAlpha(0)
    this.door=this.sprite(DOOR.x,576,`${this.doorPrefix}-${this.opts.arriving?3:0}`,1002)
    this.drawWindowSky()
    if(this.opts.arriving){
      this.doorLight.setAlpha(1)
      if(!this.opts.reducedMotion)camera.fadeIn(FADE_MS,...FADE_COLOR)
      this.time.delayedCall(this.opts.reducedMotion?0:450,()=>this.closeDoor())
      this.time.delayedCall(900,()=>this.baristaSay(pick(BARISTA_WELCOME),'wave'))
    }
    this.doorReadyAt=this.time.now+1200
    this.baristaNextLineAt=this.time.now+20_000+Math.random()*15_000
    const avatar=this.textures.exists(this.opts.avatar)?this.opts.avatar:'mochi'
    const sprite=this.sprite(spawn.x,spawn.y,avatar,spawn.y+10)
    this.self=this.visitor(sprite,this.opts.nickname,avatar,characterPhase(this.opts.nickname))
    this.fitCamera(this.opts.viewWidth??MIN_VIEW_W)
    camera.centerOn(spawn.x,H/2).startFollow(sprite,true,this.opts.reducedMotion?1:.12,1)
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
  private visitor(sprite:Phaser.GameObjects.Image,name:string,avatar:string,phase:number):Visitor{
    return {sprite,label:this.tag(sprite.x,sprite.y-NAME_TAG_GAP,name).setDepth(tagDepth(sprite.y)),avatar,name,phase,movingUntil:0,pose:'stand',sitSince:-Infinity,lift:0,sipUntil:0,relaxUntil:0,laughUntil:0,waveUntil:0,hidden:0}
  }
  // ---------- The Tanaw Deck ----------
  // The view and the deck's furniture (see tanawView.ts); rain falls there while the jukebox plays the rainy mood.
  private createDeck(){
    this.view=new TanawView(this,{doorway:DOORWAY,sceneWidth:W,lightDepth:LIGHT_DEPTH,skyMinute:this.opts.skyMinute,reducedMotion:()=>Boolean(this.opts.reducedMotion),rainy:()=>this.music==='rain'})
    // Patio umbrellas open over the deck's benches and table in the rain: over everyone under them, below the rain.
    this.patioUmbrellas=PATIO_UMBRELLAS.map(p=>this.add.image(p.x,p.y,'patio-umbrella').setOrigin(.5,1).setScale(PX).setDepth(LIGHT_DEPTH-1.5).setVisible(false))
  }
  // A thought for the view, at most every 45 seconds unless the visitor just settled at the railing or on a bench.
  private thinkAboutView(settled=false){
    if(!settled&&this.time.now<this.nextViewThought)return
    this.nextViewThought=this.time.now+45_000
    if(this.view)this.say(this.view.thought(),3200)
  }
  // The page's View button, or a tap on the view: walk to the nearest free spot at the railing (or a bench) and take it in.
  enjoyView(){
    const self=this.self
    if(!self||this.inputBlocked())return
    const seat=self.pose==='sit'&&self.seat!==undefined?SEATS[self.seat]:undefined
    if(seat?.back){this.thinkAboutView(true);return}
    const distance=(i:number)=>Math.hypot(SEATS[i]!.x-self.sprite.x,SEATS[i]!.y-self.sprite.y)
    const nearest=(seats:number[])=>seats.filter(i=>!this.seatTaken(i)).sort((a,b)=>distance(a)-distance(b))[0]
    const free=nearest(RAIL_SEATS)??nearest(BENCH_SEATS)
    if(free===undefined){this.say('Puno ang deck ngayon! Upo ka muna sa loob.');return}
    const spot=SEATS[free]!
    this.walkTo(spot.x,spot.y,()=>this.sit(free))
  }
  private createTextures(){
    const texture=(name:string,pixels:art.PixelArt)=>addTexture(this,name,pixels)
    texture('cafe-room',cafe.cafeRoomArt());texture('brick-wall',art.brickWallArt())
    for(const option of avatarOptions){
      const id=option.id
      texture(id,art.visitorArt(id,'idle'));texture(`${id}-blink`,art.visitorArt(id,'blink'))
      texture(`${id}-step1`,art.visitorArt(id,'step1'));texture(`${id}-step2`,art.visitorArt(id,'step2'))
      texture(`${id}-sit`,sittingVisitorArt(id));texture(`${id}-sit-blink`,sittingVisitorArt(id,true))
      texture(`${id}-wave`,cafe.wavingVisitorArt(id,false));texture(`${id}-sit-wave`,cafe.wavingVisitorArt(id,true))
    }
    createDeckTextures(this,DOORWAY)
    for(const open of [false,true])for(const busy of [false,true])texture(`cr-${open?'open':'closed'}-${busy?'busy':'free'}`,cafe.restroomDoorArt(open,busy))
    texture('patio-umbrella',deck.patioUmbrellaArt());texture('hand-umbrella',deck.handUmbrellaArt())
    for(const frame of ['idle','blink','wave','brew','serve'] as const)texture(`barista-${frame}`,cafe.baristaArt(frame))
    texture('cafe-counter',cafe.cafeCounterArt());texture('espresso-idle',cafe.espressoArt('idle'));texture('espresso-brew',cafe.espressoArt('brew'))
    for(const variant of [0,1,2] as const)texture(`cafe-table-${variant}`,cafe.cafeTableArt(variant))
    texture('cafe-chair',cafe.cafeChairArt());texture('sofa',cafe.sofaArt())
    createDrinkTextures(this)
    texture('big-pot',bigPotArt());texture('plant-small',art.smallPlantArt());texture('bulb-glow',glowArt(9,'#ffd98a'))
    texture('jukebox-idle',art.jukeboxArt('idle'));for(const frame of [0,1,2,3] as const)texture(`jukebox-${frame}`,art.jukeboxArt(frame))
    texture('music-note',art.musicNoteArt());texture('entrance',art.entranceArt())
    for(const time of ['day','dusk','night'] as const)for(const frame of [0,1,2,3] as const)texture(`store-door-${time}-${frame}`,art.insideDoorArt(frame,time))
    createReactionTextures(this)
  }
  private tap(x:number,y:number){
    if(this.inputBlocked())return
    const spark=()=>{if(!this.opts.reducedMotion)tapSparks(this,x,y)}
    const interact=(tx:number,ty:number,kind:string)=>{spark();this.walkTo(tx,ty,()=>this.opts.onInteract(kind))}
    // The view above the deck's railing: walk over and take it in.
    if(x>=DECK_LEFT&&y<RAIL_Y-8){spark();this.enjoyView();return}
    if(x<0||x>W){const p=nearestOpen(x,y);if(p){spark();this.walkTo(p.x,p.y)}return}
    if(CR.area.contains(x,y)){spark();this.chooseSeat([CAFE_RESTROOM_SEAT]);return}
    const bin=sceneBins.cafe.find(b=>Math.abs(x-b.x)<=18&&y>=b.y-26&&y<=b.y+16)
    if(bin){interact(bin.standX,bin.standY,'trash');return}
    if(y>=548&&x>=126&&x<=234){interact(DOOR.x,DOOR.standY,'outside');return}
    if(this.jukebox&&Math.abs(x-JUKEBOX.x)<28&&y>=JUKEBOX.y-34&&y<=JUKEBOX.y+34){interact(JUKEBOX.standX,JUKEBOX.standY,'cafe-jukebox');return}
    if(BOARD.area.contains(x,y)){interact(BOARD.standX,BOARD.standY,'cafe-board');return}
    if(WINDOW_AREA.contains(x,y)){spark();this.noticeAt(WINDOW_AREA.centerX,WINDOW_AREA.y-4,pick(WINDOW_LINES[this.daylight]),2400);return}
    const seats=this.seatsAt(x,y)
    if(seats.length){spark();this.chooseSeat(seats);return}
    if(COUNTER.area.contains(x,y)){interact(BARISTA.standX,BARISTA.standY,'barista');return}
    const point=nearestOpen(x,y)
    if(point){if(!this.opts.reducedMotion)tapSparks(this,point.x,point.y);this.walkTo(point.x,point.y)}
  }
  // The seats a tap means, best first: a chair, the sofa, a whole table or bench (nearest seat first), or the railing.
  private seatsAt(x:number,y:number){
    const chair=SEATS.findIndex(seat=>seat.table!==undefined&&Math.abs(x-seat.x)<=16&&y>=seat.y-40&&y<=seat.y+2)
    if(chair>=0)return [chair]
    const byDistance=(indexes:number[])=>indexes.sort((a,b)=>Math.abs(SEATS[a]!.x-x)-Math.abs(SEATS[b]!.x-x))
    if(SOFA.area.contains(x,y))return byDistance(seatsOf('sofa'))
    const table=TABLES.findIndex(t=>Math.abs(x-t.x)<=36&&y>=t.y-22&&y<=t.y+24)
    if(table>=0)return byDistance(SEATS.flatMap((seat,i)=>seat.table===table?[i]:[]))
    const bench=BENCHES.find(b=>Math.abs(x-b.x)<=40&&y>=366&&y<=412)
    if(bench)return byDistance([...bench.seats])
    return x>=DECK_LEFT&&x<=W&&y>=RAIL_Y-8&&y<=RAIL_Y+24?byDistance([...RAIL_SEATS]):[]
  }
  private seatTaken(seat:number){return [...this.remotes.values()].some(remote=>remote.pose==='sit'&&remote.seat===seat)}
  private chooseSeat(seats:number[]){
    const self=this.self
    if(!self)return
    const free=seats.find(seat=>!this.seatTaken(seat))
    if(free===undefined){this.say(seats[0]===CAFE_RESTROOM_SEAT?'May tao pa sa CR! Hintay lang.':seats.length>1?SEATS[seats[0]!]!.kind==='rail'?'Puno ang railing! Try a bench.':'Occupied na! Try another spot.':'Someone is sitting there!');return}
    if(self.pose==='sit'&&self.seat===free)return
    const spot=SEATS[free]!
    this.walkTo(spot.x,spot.y,()=>this.sit(free))
  }
  private sit(seat:number){
    const self=this.self,spot=SEATS[seat]
    if(!self||!spot)return
    if(this.seatTaken(seat)){this.say(seat===CAFE_RESTROOM_SEAT?'May tao pa sa CR! Hintay lang.':'Someone is sitting there!');return}
    self.sprite.setPosition(spot.x,spot.y)
    // Send the final floor position first so the server never reads a late move as standing up.
    this.flushMove()
    self.pose='sit';self.seat=seat;self.sitSince=this.time.now
    this.opts.onPose('sit',seat)
    // In the CR for a few seconds, then back out on their own (moving first comes out sooner).
    if(spot.kind==='restroom')this.time.delayedCall(RESTROOM_MS,()=>{if(self.pose==='sit'&&self.seat===seat)this.standUp()})
    // Settled at the railing or on a bench facing the view: a moment, then a little thought about it.
    if(spot.back)this.time.delayedCall(600,()=>{if(self.pose==='sit'&&self.seat===seat)this.thinkAboutView(true)})
  }
  standUp(notify=true){
    const self=this.self
    if(!self||self.pose!=='sit')return
    const fromCr=self.seat===CAFE_RESTROOM_SEAT
    self.pose='stand';self.seat=undefined
    if(notify){this.opts.onPose('stand');if(fromCr)this.cameOut(self)}
  }
  // Out of the CR, with a little line for everyone to see.
  private cameOut(visitor:Visitor){this.time.delayedCall(this.opts.reducedMotion?0:250,()=>this.bubbleOn(visitor,pick(CR_LINES),2400))}
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
  private say(text:string,ms=2200){const self=this.self;if(self)this.noticeAt(self.sprite.x,self.sprite.y-self.lift-BUBBLE_GAP,text,ms,140)}
  // ---------- The barista ----------
  private baristaSay(line:string,mode?:'wave'){
    const barista=this.barista
    if(!barista)return
    this.baristaBubbleTimer?.remove(false);this.baristaBubble?.destroy()
    const bubble=this.tag(barista.x,barista.y-30,line,TAG_FONT,170).setDepth(900)
    this.baristaBubble=bubble
    this.baristaBubbleTimer=this.time.delayedCall(Math.min(5000,Math.max(2400,line.length*70)),()=>{if(this.baristaBubble===bubble)this.baristaBubble=undefined;bubble.destroy();this.baristaBubbleTimer=undefined})
    this.baristaNextLineAt=this.time.now+25_000+Math.random()*20_000
    if(mode==='wave'&&this.baristaMode==='idle'){this.baristaMode='wave';this.baristaUntil=this.time.now+1200}
  }
  private get baristaBusy(){return this.baristaMode==='brew'||this.baristaMode==='serve'}
  // Brew (machine on, steam), hand the cup over the counter, and it floats to the visitor's hand.
  orderDrink(drink:DrinkId,surprise=false){
    const option=drinkOptions.find(d=>d.id===drink)
    if(!option||!this.barista)return
    if(this.self?.drink){this.baristaSay(HOLDING_ALREADY);return}
    if(this.baristaBusy){this.baristaSay('Sandali lang po, may ginagawa pa ako!');return}
    this.baristaSay(surprise?`Surprise! Isang ${option.label}, coming up!`:`Isang ${option.label}, coming up!`)
    const quick=Boolean(this.opts.reducedMotion)
    this.baristaMode='brew';this.baristaUntil=Infinity
    this.time.delayedCall(quick?700:1800,()=>{
      const barista=this.barista!
      this.baristaMode='serve';this.baristaUntil=Infinity
      this.servingCup?.destroy()
      const cup=this.sprite(barista.x,barista.y+10,`cup-${drink}`,210)
      this.servingCup=cup
      this.time.delayedCall(quick?400:600,()=>{
        const self=this.self
        const done=()=>{if(this.servingCup===cup)this.servingCup=undefined;cup.destroy();if(self)this.holdDrink(self,drink);this.opts.onDrink(drink);this.baristaMode='idle';this.baristaSay(option.line)}
        if(!self||quick){done();return}
        const to=this.cupSpot(self)
        cup.setDepth(650)
        this.tweens.add({targets:cup,x:to.x,y:to.y,duration:380,ease:'Quad.easeOut',onComplete:done})
      })
    })
  }
  // Another visitor got a drink: the barista hands it over too, without the wait.
  private serveRemote(remote:Visitor){
    if(this.baristaBusy||!this.barista)return
    this.baristaMode='serve';this.baristaUntil=this.time.now+700
    if(this.time.now>=this.baristaNextLineAt-20_000)this.baristaSay(`Enjoy, ${shortName(remote.name)}!`)
  }
  private updateBarista(){
    const barista=this.barista,now=this.time.now,motion=!this.opts.reducedMotion
    if(!barista)return
    if(this.baristaMode!=='idle'&&now>=this.baristaUntil)this.baristaMode='idle'
    let frame:cafe.BaristaFrame
    if(this.baristaMode==='brew')frame=motion&&Math.floor(now/260)%2?'idle':'brew'
    else if(this.baristaMode==='serve')frame='serve'
    else if(this.baristaMode==='wave')frame=motion&&Math.floor(now/200)%2?'idle':'wave'
    else frame=motion&&(now+900)%4100<140?'blink':'idle'
    const texture=`barista-${frame}`
    if(barista.texture.key!==texture)barista.setTexture(texture)
    const breathe=motion&&this.baristaMode==='idle'&&Math.floor(now/1100)%2?PX/2:0
    if(barista.y!==BARISTA.y-breathe)barista.setY(BARISTA.y-breathe)
    const espresso=this.baristaMode==='brew'?'espresso-brew':'espresso-idle'
    if(this.espresso&&this.espresso.texture.key!==espresso)this.espresso.setTexture(espresso)
    // Greets a visitor who walks up to the counter, at most every half minute; otherwise says something now and then.
    const self=this.self?.sprite
    if(self&&!this.baristaBusy&&self.y<330&&Math.abs(self.x-BARISTA.standX)<70&&now-this.baristaGreetedAt>30_000&&this.hasPlayers){this.baristaGreetedAt=now;this.baristaSay(pick(BARISTA_NEAR),'wave')}
    else if(!this.baristaBubble&&now>=this.baristaNextLineAt&&this.opts.controlsEnabled!==false)this.baristaSay(pick(BARISTA_IDLE_LINES))
  }
  // Steam puffs from the machine now and then, and all the time while brewing; hot cups steam a little too.
  private updateSteam(){
    const steam=this.steam,motion=!this.opts.reducedMotion
    if(!steam)return
    const frame=motion?Math.floor(this.time.now/140):-1
    if(frame===this.steamFrame)return
    this.steamFrame=frame
    steam.clear()
    if(frame<0)return
    const brewing=this.baristaMode==='brew',puffing=brewing||frame%50<16
    if(puffing)for(let i=0;i<3;i++){
      const rise=((frame*2+i*5)%14)*PX/2
      steam.fillStyle(0xffffff,Math.max(0,.7-rise/20)).fillRect(ESPRESSO.x-12+i*10+(Math.floor((frame+i)/3)%2?PX:0),ESPRESSO.y-16-rise,PX,PX*2)
    }
    for(const visitor of [this.self,...this.remotes.values()]){
      const cup=visitor?.cup
      if(!cup?.visible||cup.alpha<.5||!visitor?.drink||!HOT_DRINKS.has(visitor.drink))continue
      const rise=(frame%6)*PX/2
      steam.fillStyle(0xffffff,.55-rise/16).fillRect(cup.x-PX+(frame%4<2?0:PX),cup.y-cup.displayHeight/2-PX*2-rise,PX,PX)
    }
  }
  // ---------- Drinks and actions ----------
  private cupSpot(visitor:Visitor){
    const {sprite,lift}=visitor,seat=visitor.pose==='sit'&&visitor.seat!==undefined?SEATS[visitor.seat]:undefined,now=this.time.now
    if(now<visitor.sipUntil)return {x:sprite.x+6,y:sprite.y-lift-2}
    // At a table the cup waits on the tabletop in front of its owner; out on the deck, on the railing or the bench beside them.
    if(seat?.table!==undefined&&now-visitor.sitSince>SIT_MS)return {x:seat.x+(seat.x<TABLES[seat.table]!.x?6:-6),y:TABLES[seat.table]!.y-20}
    if(seat?.kind==='rail')return {x:sprite.x+14,y:RAIL_Y-2}
    if(seat?.kind==='bench'&&now-visitor.sitSince>SIT_MS)return {x:sprite.x+16,y:378}
    return {x:sprite.x+13,y:sprite.y-lift+8}
  }
  // A drink let go goes into the bin the visitor stands by (that's the only way to let one go).
  private holdDrink(visitor:Visitor,drink:HeldDrink|null){
    visitor.drink=drink??undefined
    if(!drink){
      const cup=visitor.cup,bin=binNear(this.bins,visitor.sprite.x,visitor.sprite.y)
      visitor.cup=undefined
      if(cup&&bin)tossIntoBin(this,cup,bin,Boolean(this.opts.reducedMotion));else cup?.destroy()
      return
    }
    if(visitor.cup)visitor.cup.setTexture(`cup-${drink}`)
    else visitor.cup=this.sprite(visitor.sprite.x,visitor.sprite.y,`cup-${drink}`,visitor.sprite.depth+.5)
    this.placeTags(visitor)
  }
  setDrink(id:string,drink:HeldDrink|null){
    const target=id===this.selfId?this.self:this.remotes.get(id)
    if(!target||target.drink===(drink??undefined))return
    if(target!==this.self&&drink&&target.cup===undefined)this.serveRemote(target)
    this.holdDrink(target,drink)
  }
  // The visitor's own action plays at once; the server shares it with everyone else in the café.
  act(action:CafeAction){
    const self=this.self
    if(!self||(action==='sip'&&!self.drink))return false
    this.playOn(self,action)
    this.opts.onAct(action)
    return true
  }
  playAction(id:string,action:CafeAction){const target=id===this.selfId?undefined:this.remotes.get(id);if(target)this.playOn(target,action)}
  private playOn(visitor:Visitor,action:CafeAction){
    const now=this.time.now
    if(action==='sip'){if(visitor.drink)visitor.sipUntil=now+1200}
    else{visitor.relaxUntil=now+2400;this.bubbleOn(visitor,'ahh~',1800)}
  }
  // ---------- Movement and drawing ----------
  walkTo(x:number,y:number,callback?:()=>void){
    if(!this.self||this.inputBlocked())return
    this.path=pathFind(new Phaser.Math.Vector2(this.self.sprite.x,this.self.sprite.y),new Phaser.Math.Vector2(x,y));this.afterPath=callback
    if(!this.path.length&&callback&&Math.hypot(this.self.sprite.x-Math.round(x/CELL)*CELL,this.self.sprite.y-Math.round(y/CELL)*CELL)<CELL){this.afterPath=undefined;callback()}
  }
  setDirection(x:number,y:number){if(this.inputBlocked()){this.resetMovement();return}this.direction.set(x,y);if(x||y){this.path=[];this.afterPath=undefined}}
  private inputBlocked(){
    const active=document.activeElement
    return this.opts.controlsEnabled===false||Boolean(document.querySelector('dialog[open]'))||
      (active instanceof HTMLElement&&(active.isContentEditable||Boolean(active.closest('input,textarea,select,[role="textbox"]'))))
  }
  private resetMovement(){this.direction.set(0,0);this.path=[];this.afterPath=undefined;this.input?.keyboard?.resetKeys()}
  setControlsEnabled(value:boolean){this.opts.controlsEnabled=value;this.resetMovement();if(this.input?.keyboard)this.input.keyboard.enabled=value}
  // Narrower than café and deck together, the camera follows the visitor between them; wider, both are in view, centred.
  private fitCamera(width:number){
    const extra=Math.max(0,width-W)/2
    this.cameras.main.setSize(width*this.zoom,H*this.zoom).setBounds(-extra,0,W+extra*2,H)
  }
  setViewWidth(width:number){
    if(!this.sys?.isActive())return
    this.scale.setGameSize(width*this.zoom,H*this.zoom)
    this.fitCamera(width)
  }
  setReducedMotion(value:boolean){this.opts.reducedMotion=value;this.steamFrame=-2;this.windowFrame=-2;this.view?.setReducedMotion();this.cameras.main.setLerp(value?1:.12,1)}
  setMusic(mood:CafeMood|null){
    if(this.music===mood)return
    this.music=mood;this.windowFrame=-2;this.view?.applySky()
    for(const umbrella of this.patioUmbrellas)umbrella.setVisible(mood==='rain')
  }
  private animateVisitor(visitor:Visitor,moving:boolean){
    const {sprite,avatar,phase}=visitor,motion=!this.opts.reducedMotion,now=this.time.now
    let texture=avatar,lift=0
    const seated=visitor.pose==='sit',seat=seated&&visitor.seat!==undefined?SEATS[visitor.seat]:undefined
    // Seen from behind at the railing and on the deck benches, so no blinking there.
    const pose=seat?.kind==='rail'?'lean':seat?.kind==='bench'?'back-sit':seated&&seat?.kind!=='restroom'?'sit':''
    // Going into the CR: the visitor slips down through its door and out of sight, and back up on the way out.
    const inside=seat?.kind==='restroom'?1:0
    if(visitor.hidden!==inside)visitor.hidden=motion?Math.max(0,Math.min(1,visitor.hidden+(inside?1:-1)/14)):inside
    if(seat?.kind==='rail')texture=`${avatar}-lean`
    else if(seat?.kind==='restroom')texture=avatar
    else if(seated){
      const seatLift=seat?.lift??24
      const progress=motion?Math.min(1,(now-visitor.sitSince)/SIT_MS):1
      lift=Math.round((seatLift*progress+Math.sin(progress*Math.PI)*6)/PX)*PX
      texture=progress<.5?avatar:seat?.back?`${avatar}-${pose}`:`${avatar}-sit${motion&&(now+phase)%4200<130?'-blink':''}`
    }else if(motion)({texture,lift}=visitorFrame(avatar,phase,now,moving))
    const settled=!seated||seat?.kind==='rail'||now-visitor.sitSince>=SIT_MS/2
    if(settled&&now<visitor.waveUntil&&(!motion||Math.floor(now/220)%2===0))texture=`${avatar}${pose?`-${pose}`:''}-wave`
    else if(settled&&!seat?.back&&(now<visitor.sipUntil||now<visitor.relaxUntil))texture=`${avatar}${seated?'-sit':''}-blink`
    if(motion&&now<visitor.laughUntil&&Math.floor(now/110)%2)lift+=PX
    if(!this.textures.exists(texture))texture=avatar
    if(visitor.hidden)lift-=Math.round(visitor.hidden*18/PX)*PX
    if(sprite.texture.key!==texture)sprite.setTexture(texture)
    sprite.setOrigin(.5,.5+lift/sprite.displayHeight)
    if(lift!==visitor.lift)visitor.lift=lift
    this.placeTags(visitor)
  }
  private placeTags(visitor:Visitor){
    const {sprite,label,bubble,lift,cup}=visitor,top=sprite.y-lift
    if(label.x!==sprite.x||label.y!==top-NAME_TAG_GAP)label.setPosition(sprite.x,top-NAME_TAG_GAP)
    if(bubble instanceof Tag)bubble.setPosition(sprite.x,top-BUBBLE_GAP)
    else bubble?.setPosition(sprite.x,top-BUBBLE_GAP-20)
    const seat=visitor.pose==='sit'&&visitor.seat!==undefined?SEATS[visitor.seat]:undefined
    const shown=1-visitor.hidden
    for(const part of [sprite,label,cup])if(part&&part.alpha!==shown)part.setAlpha(shown)
    // On a deck bench the backrest is drawn over the visitor, so they sit a little lower in the drawing order.
    setDepthIfChanged(sprite,seat?.kind==='bench'?sprite.y:sprite.y+10);setDepthIfChanged(label,tagDepth(sprite.y))
    if(cup){
      const spot=this.cupSpot(visitor)
      if(cup.x!==spot.x||cup.y!==spot.y)cup.setPosition(spot.x,spot.y)
      setDepthIfChanged(cup,seat?.table!==undefined?TABLES[seat.table]!.y+21:sprite.depth+.5)
    }
    // Out on the deck in the rain, a small umbrella, unless a patio umbrella already covers the seat.
    const wet=this.music==='rain'&&sprite.x>=DECK_LEFT&&seat?.kind!=='bench'&&seat?.table!==DECK_TABLE
    if(wet&&!visitor.umbrella)visitor.umbrella=this.sprite(0,0,'hand-umbrella',0).setOrigin(.5,0)
    const umbrella=visitor.umbrella
    if(umbrella){
      if(umbrella.visible!==wet)umbrella.setVisible(wet)
      if(wet){if(umbrella.x!==sprite.x+3||umbrella.y!==top-30)umbrella.setPosition(sprite.x+3,top-30);setDepthIfChanged(umbrella,sprite.depth+.6)}
    }
  }
  // Bulbs glow brighter after dark and breathe slightly; the window shows a drifting cloud, stars, or rain.
  private updateAmbient(){
    const now=this.time.now,motion=!this.opts.reducedMotion,base=BULB_GLOW[this.daylight]
    this.bulbs.forEach((bulb,i)=>{const alpha=motion?Math.min(1,base-.05+Math.round((Math.sin(now/1300+i*1.7)*.5+.5)*3)/30):base;if(bulb.alpha!==alpha)bulb.setAlpha(alpha)})
    this.updateWindow()
    this.view?.update()
    // The CR's light is red while someone is inside; its door stands open while someone goes in or comes out.
    if(this.crDoor){
      const visitors=[this.self,...this.remotes.values()]
      const busy=visitors.some(v=>v?.pose==='sit'&&v.seat===CAFE_RESTROOM_SEAT),open=visitors.some(v=>v&&v.hidden>0&&v.hidden<1)
      const texture=`cr-${open?'open':'closed'}-${busy?'busy':'free'}`
      if(this.crDoor.texture.key!==texture)this.crDoor.setTexture(texture)
    }
    const box=this.jukebox
    if(box){
      const playing=this.music!==null
      const texture=!playing?'jukebox-idle':motion?`jukebox-${Math.floor(now/320)%4}`:'jukebox-0'
      if(box.texture.key!==texture)box.setTexture(texture)
      this.notes.forEach((note,i)=>{
        if(!playing||!motion){if(note.visible)note.setVisible(false);return}
        const progress=((now+i*900)%2700)/2700
        note.setPosition(box.x+[-12,0,10][i]!+(Math.floor(progress*6)%2?PX:0),box.y-34-Math.round(progress*10)*PX)
          .setAlpha(progress<.15?progress/.15:Math.max(0,1-(progress-.15)/.85)).setVisible(true)
      })
    }
  }
  private get doorPrefix(){return `store-door-${this.daylight}`}
  private drawWindowSky(){
    const sky=this.windowSky,g=cafe.CAFE_WINDOW_GLASS
    if(!sky)return
    sky.clear()
    if(this.daylight!=='day'){
      const night=this.daylight==='night'
      sky.fillStyle(night?0x28324f:0xe59a83).fillRect(g.x*PX,g.y*PX,g.w*PX,g.h*PX)
      if(!night)sky.fillStyle(0x8a74b0).fillRect(g.x*PX,g.y*PX,g.w*PX,10*PX).fillStyle(0xf6c28f).fillRect(g.x*PX,(g.y+g.h-8)*PX,g.w*PX,8*PX)
      else sky.fillStyle(0xffd98a,.5).fillRect((g.x+4)*PX,(g.y+g.h-6)*PX,PX,6*PX).fillStyle(0xffd98a,.25).fillRect((g.x+2)*PX,(g.y+g.h-8)*PX,5*PX,2*PX)
      // Mullions stay in front of the painted sky.
      sky.fillStyle(0x6b4630).fillRect((g.x+g.w/2-1)*PX,g.y*PX,2*PX,g.h*PX).fillRect(g.x*PX,(g.y+18)*PX,g.w*PX,2*PX)
    }
    const color={day:0xfff3c4,dusk:0xf6c28f,night:0xffd98a}[this.daylight],strength=this.daylight==='night'?.6:1
    this.doorLight?.clear().fillStyle(color,.45*strength).fillRect(132,566,96,6).fillStyle(color,.25*strength).fillRect(142,560,76,6)
    if(this.door)this.door.setTexture(this.door.texture.key.replace(/^store-door-\w+-/,`${this.doorPrefix}-`))
    this.windowFrame=-2
  }
  private updateWindow(){
    const fx=this.windowFx,g=cafe.CAFE_WINDOW_GLASS,motion=!this.opts.reducedMotion,rain=this.music==='rain'
    if(!fx)return
    const frame=!motion?-1:rain?Math.floor(this.time.now/90):Math.floor(this.time.now/600)
    if(frame===this.windowFrame)return
    this.windowFrame=frame
    fx.clear()
    const left=g.x*PX,top=g.y*PX,width=g.w*PX,height=g.h*PX,mullionX=left+(g.w/2-1)*PX
    const inGlass=(x:number,y:number)=>x>=left&&x<left+width&&y>=top&&y<top+height&&(x<mullionX||x>=mullionX+PX*2)
    if(rain){
      // While the café jukebox plays the rainy mood: a grey wash and falling streaks.
      fx.fillStyle(0x6a7f95,.35).fillRect(left,top,width,height)
      for(let i=0;i<9;i++){
        const x=left+((i*29+7)%(g.w-2))*PX,y=top+((Math.max(0,frame)*3+i*17)%g.h)*PX
        if(inGlass(x,y))fx.fillStyle(0xdfeef5,.75).fillRect(x,y,PX/2,Math.min(PX*3,top+height-y))
      }
    }else if(this.daylight==='night'){
      for(const [x,y,i] of [[4,4,0],[13,9,1],[24,3,2],[31,12,3],[8,14,4]] as const)
        if(!motion||(Math.max(0,frame)+i)%5)fx.fillStyle(0xfff3d6,.9).fillRect(left+x*PX,top+y*PX,PX/2,PX/2)
    }else if(this.daylight==='day'&&motion){
      // One small cloud drifts across the top of the window.
      const cx=left+((frame*PX)%(width+24))-12
      for(const [dx,dy,w] of [[0,8,10],[3,6,5]] as const)for(let x=cx+dx;x<cx+dx+w;x+=PX/2)if(inGlass(x,top+dy))fx.fillStyle(0xffffff,.85).fillRect(x,top+dy,PX/2,PX)
    }
  }
  private closeDoor(){
    if(this.door)slideDoor(this,this.door,this.doorPrefix,false,Boolean(this.opts.reducedMotion))
    if(this.doorLight)this.tweens.add({targets:this.doorLight,alpha:0,duration:this.opts.reducedMotion?0:240})
  }
  private checkDoorPush(pushY:number,delta:number){
    const sprite=this.self!.sprite
    if(sprite.y<DOOR.triggerY-16)this.doorTriggered=false
    const pushing=pushY>.5&&sprite.y>=DOOR.triggerY&&Math.abs(sprite.x-DOOR.x)<=DOOR.halfWidth
    this.doorPush=pushing?this.doorPush+delta:0
    if(this.doorPush>=DOOR.pushMs&&!this.doorTriggered&&this.time.now>=this.doorReadyAt){this.doorTriggered=true;this.opts.onInteract('outside')}
  }
  exitScene(){
    return new Promise<void>(resolve=>{
      const self=this.self
      if(!self||!this.door){resolve();return}
      this.standUp(false)
      this.exiting={x:self.sprite.x,y:self.sprite.y};this.resetMovement();this.doorTriggered=true
      this.tweens.killTweensOf(this.doorLight!);this.doorLight?.setAlpha(1)
      const instant=Boolean(this.opts.reducedMotion)
      slideDoor(this,this.door,this.doorPrefix,true,instant,()=>{
        if(instant){resolve();return}
        this.tweens.add({targets:self.sprite,y:self.sprite.y+24,alpha:0,duration:FADE_MS,onUpdate:()=>{self.label.setPosition(self.sprite.x,self.sprite.y-NAME_TAG_GAP).setAlpha(self.sprite.alpha);self.cup?.setAlpha(self.sprite.alpha)}})
        this.cameras.main.fade(FADE_MS,...FADE_COLOR,true,(_:unknown,progress:number)=>{if(progress>=1)resolve()})
      })
    })
  }
  cancelExit(){
    const from=this.exiting,self=this.self
    this.exiting=undefined;this.doorPush=0;this.doorReadyAt=this.time.now+1200
    if(from&&self){this.tweens.killTweensOf(self.sprite);self.sprite.setPosition(from.x,from.y).setAlpha(1);self.label.setAlpha(1);self.cup?.setAlpha(1);this.placeTags(self)}
    if(this.opts.reducedMotion)this.cameras.main.resetFX();else this.cameras.main.fadeEffect.start(false,FADE_MS,...FADE_COLOR,true)
    this.closeDoor()
  }
  override update(_:number,delta:number){
    this.updateAmbient()
    this.updateBarista()
    this.updateSteam()
    for(const remote of this.remotes.values())this.animateVisitor(remote,this.time.now<remote.movingUntil)
    const self=this.self
    if(!self)return
    if(this.exiting||this.inputBlocked()){this.resetMovement();this.doorPush=0;if(!this.exiting)this.animateVisitor(self,false);return}
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
    // Stepping out onto the deck for the first time in a while brings a thought about the view.
    const onDeck=sprite.x>=DECK_LEFT
    if(onDeck&&!this.onDeck)this.thinkAboutView()
    this.onDeck=onDeck
    if(this.time.now-this.lastMove>90&&Math.hypot(sprite.x-this.lastX,sprite.y-this.lastY)>1){
      this.lastMove=this.time.now;this.lastX=sprite.x;this.lastY=sprite.y;this.opts.onMove(Math.round(sprite.x),Math.round(sprite.y))
    }
  }
  setPlayers(players:Player[],selfId:string){
    if(selfId!==this.selfId&&this.self){
      const own=players.find(p=>p.id===selfId)
      if(own){this.self.sprite.setPosition(own.x,own.y);this.lastX=own.x;this.lastY=own.y;this.path=[];this.afterPath=undefined;this.standUp(false);this.holdDrink(this.self,isHeldDrink(own.drink)?own.drink:null)}
    }
    this.selfId=selfId
    // A visitor can change their name mid-visit (see /api/me/nickname); the next list carries it to every name tag.
    for(const p of players){const visitor=p.id===selfId?this.self:this.remotes.get(p.id);if(visitor&&visitor.label.text!==p.nickname){visitor.label.setText(p.nickname);visitor.name=p.nickname;}}
    const incoming=new Set(players.filter(p=>p.id!==selfId).map(p=>p.id))
    for(const [id,p] of this.remotes)if(!incoming.has(id)){p.sprite.destroy();p.label.destroy();p.bubble?.destroy();p.cup?.destroy();p.umbrella?.destroy();this.remotes.delete(id)}
    let arrived:Visitor|undefined
    for(const p of players){if(p.id===selfId)continue
      let remote=this.remotes.get(p.id)
      if(!remote){
        const avatar=this.textures.exists(p.avatar)?p.avatar:'mochi'
        remote=this.visitor(this.sprite(p.x,p.y,avatar,p.y+10),p.nickname,avatar,characterPhase(p.id))
        this.remotes.set(p.id,remote)
        arrived=remote
      }
      // Someone already seated when this visitor arrives is drawn seated, without the hop.
      if(p.pose==='sit'&&remote.pose!=='sit'){remote.sprite.setPosition(p.x,p.y);remote.pose='sit';remote.seat=p.seat;remote.sitSince=-Infinity;remote.hidden=p.seat===CAFE_RESTROOM_SEAT?1:0}
      else if(p.pose!=='sit')this.movePlayer(p.id,p.x,p.y)
      const drink=isHeldDrink(p.drink)?p.drink:undefined
      if(remote.drink!==drink)this.holdDrink(remote,drink??null)
      this.placeTags(remote)
    }
    // Newcomers after the first list are greeted by name (the first list is everyone already here).
    if(arrived&&this.hasPlayers&&!this.baristaBusy&&!this.baristaBubble)this.baristaSay(pick(BARISTA_HELLO).replace('{name}',shortName(arrived.name)),'wave')
    this.hasPlayers=true
  }
  setPose(id:string,pose:Pose,seat?:number){
    if(id===this.selfId){if(pose==='stand'&&this.self?.pose==='sit'){const cr=this.self.seat===CAFE_RESTROOM_SEAT;this.standUp(false);this.say(cr?'May tao pa sa CR! Hintay lang.':'Someone is sitting there!')}return}
    const remote=this.remotes.get(id)
    if(!remote)return
    if(pose==='sit'){
      if(remote.pose==='sit'&&remote.seat===seat)return
      this.tweens.killTweensOf(remote.sprite)
      const spot=seat===undefined?undefined:SEATS[seat]
      if(spot)remote.sprite.setPosition(spot.x,spot.y)
      remote.pose='sit';remote.seat=seat;remote.sitSince=this.time.now
    }else{if(remote.seat===CAFE_RESTROOM_SEAT)this.cameOut(remote);remote.pose='stand';remote.seat=undefined}
    this.placeTags(remote)
  }
  movePlayer(id:string,x:number,y:number){
    const remote=this.remotes.get(id)
    if(!remote)return
    if(remote.pose==='sit'){if(remote.seat===CAFE_RESTROOM_SEAT)this.cameOut(remote);remote.pose='stand';remote.seat=undefined}
    if(Math.hypot(x-remote.sprite.x,y-remote.sprite.y)<=.5)return
    remote.movingUntil=this.time.now+200
    this.tweens.killTweensOf(remote.sprite)
    this.tweens.add({targets:remote.sprite,x,y,duration:115,onUpdate:()=>this.placeTags(remote)})
  }
  private bubbleOn(visitor:Visitor,text:string,ms=3500){
    const {sprite,lift}=visitor,reaction=reactionTexture(text)
    visitor.bubble?.destroy()
    const bubble=reaction?this.sprite(sprite.x,sprite.y-lift-BUBBLE_GAP-20,reaction,900):this.tag(sprite.x,sprite.y-lift-BUBBLE_GAP,text.slice(0,32),TAG_FONT,140).setDepth(900)
    visitor.bubble=bubble
    this.time.delayedCall(ms,()=>{if(visitor.bubble===bubble)visitor.bubble=undefined;bubble.destroy()})
  }
  // Chat lines and emotes; a wave or a laugh also moves the avatar.
  showBubble(id:string,text:string){
    const target=id===this.selfId?this.self:this.remotes.get(id)
    if(!target)return
    if(text==='👋')target.waveUntil=this.time.now+1400
    if(text==='😂')target.laughUntil=this.time.now+1400
    this.bubbleOn(target,text)
  }
}

export function createCafe(el:HTMLElement,opts:Options):CafeGame{
  const zoom=Math.max(1,Math.min(4,Math.round(opts.zoom??1))),viewW=opts.viewWidth??MIN_VIEW_W
  const scene=new CafeScene({...opts,zoom})
  const game=new Phaser.Game({type:Phaser.AUTO,parent:el,width:viewW*zoom,height:H*zoom,backgroundColor:'#6e4a31',pixelArt:true,
    scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_HORIZONTALLY,width:viewW*zoom,height:H*zoom},scene:[scene],render:{antialias:false}})
  const active=()=>Boolean(scene.sys?.isActive())
  return {game,setDirection:(x,y)=>scene.setDirection(x,y),setPlayers:(players,id)=>{if(active())scene.setPlayers(players,id)},movePlayer:(id,x,y)=>{if(active())scene.movePlayer(id,x,y)},
    showBubble:(id,text)=>{if(active())scene.showBubble(id,text)},setReducedMotion:value=>{if(active())scene.setReducedMotion(value)},setControlsEnabled:value=>scene.setControlsEnabled(value),
    exitScene:()=>active()?scene.exitScene():Promise.resolve(),cancelExit:()=>{if(active())scene.cancelExit()},setViewWidth:width=>scene.setViewWidth(width),
    setPose:(id,pose,seat)=>{if(active())scene.setPose(id,pose,seat)},setDrink:(id,drink)=>{if(active())scene.setDrink(id,drink)},playAction:(id,action)=>{if(active())scene.playAction(id,action)},
    orderDrink:(drink,surprise)=>{if(active())scene.orderDrink(drink,surprise)},act:action=>{if(active())scene.act(action)},sip:()=>active()&&scene.act('sip'),standUp:()=>{if(active())scene.standUp()},setMusic:mood=>{if(active())scene.setMusic(mood)},enjoyView:()=>{if(active())scene.enjoyView()}}
}
