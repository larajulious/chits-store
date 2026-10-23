import Phaser from 'phaser'
import { avatarOptions, type AvatarId } from '../shared/avatars'
import { reactionOptions } from '../shared/reactions'
import type {OrderStatus} from '../shared/order-status'
import {mascotFloorPoint,residentCats,storeObstacles,type CatName,type CatSnapshot} from '../shared/store-mascot'
import {createLocalMascot} from './localMascot'
import * as art from './pixelArt'

export type Avatar = AvatarId
export type Player = { id:string;nickname:string;avatar:string;x:number;y:number }
export type BoardOrder = { id:number;number:string;name:string|null;status:OrderStatus }
export type StoreGame = { game:Phaser.Game; setDirection:(x:number,y:number)=>void;setPlayers:(players:Player[],selfId:string)=>void;movePlayer:(id:string,x:number,y:number)=>void;tossYarn:()=>boolean;petCat:()=> 'petted'|'too_far'|'busy';showBubble:(id:string,text:string)=>void;showStaffBubble:(text:string)=>void;setBoard:(orders:BoardOrder[])=>void;setReducedMotion:(value:boolean)=>void;setControlsEnabled:(value:boolean)=>void;setJukebox:(state:JukeboxScene)=>void;setMenuItems:(items:string[]|null)=>void }
// playing: the shared jukebox has a song on. audible: this visitor is listening to it.
export type JukeboxScene={playing:boolean;audible:boolean}
type Options = {nickname:string;avatar:Avatar;onMove:(x:number,y:number)=>void;onInteract:(kind:string)=>void;onCatMeow:(name:CatName)=>void;catEnabled?:boolean;guideEnabled?:boolean;reducedMotion?:boolean;controlsEnabled?:boolean;zoom?:number}
type Character = {sprite:Phaser.GameObjects.Image;avatar:string;phase:number}
type ShopCat = {name:CatName;roams:boolean;sprite:Phaser.GameObjects.Image;label:Tag;skin:string}
// Texture prefix per cat; Miming keeps the original cat-* names.
const CAT_SKINS:Record<CatName,string>={Miming:'cat',Onay:'onay'}
const CAT_POSES=[['idle','stand'],['walk','walk'],['sit','sit'],['rest','lie'],['sleep','sleep'],['stretch','stretch'],['notice','notice'],['play','play']] as const
type VisitorCharacter = Character & {label:Tag;movingUntil:number;bubble?:Tag|Phaser.GameObjects.Image}
function characterPhase(id:string){let hash=0;for(const char of id)hash=(hash*31+char.charCodeAt(0))>>>0;return hash%6000}
// Phaser queues a full display-list sort on every setDepth call, even if the value is unchanged.
function setDepthIfChanged(object:{depth:number;setDepth:(value:number)=>unknown},depth:number){if(object.depth!==depth)object.setDepth(depth)}
// The world stays 360x580 with the floor at y 260..542: the server validates moves against it.
const W=360,H=580,CELL=20,PX=art.ART_SCALE
const FONT='Silkscreen, monospace'
const NAME_TAG_GAP=28,BUBBLE_GAP=54,TAG_FONT=10,TAG_PAD_Y=4
// Name tags draw above every character and piece of furniture (still ordered by y), below chat bubbles.
const tagDepth=(y:number)=>600+y/10
const obstructions=storeObstacles.map(box=>new Phaser.Geom.Rectangle(box.x,box.y,box.w,box.h))
const feedbackArea=obstructions[0]!
// The guide's loop keeps clear of Miming's spot by the yarn and Onay's spot by the feedback board.
// Back-right corner beside the order counter, above the walkable floor (y 260+), so it never blocks movement.
const JUKEBOX={x:328,y:227,standX:320,standY:300,depth:256}
// What the walking menu guide says now and then. Item lines use real names from today's menu;
// before the menu is posted the guide only says it's on the way.
const GUIDE_LINES=["Have you checked today's menu?",'Meryenda time! Tap me for the menu.',"Hungry? Today's menu is ready!",'Psst... tap me to see the menu!','Gutom ka na? Check the menu!','Something sweet is on the menu today!','Fresh meryenda today. Come see!']
const GUIDE_ITEM_LINES=['Try the {item} today!',"{item} is on today's menu!",'Have you tried our {item}?','Craving {item}? Tap me!','Fresh {item}, just for you!']
const HALLOWEEN_GUIDE_LINES=['Happy Halloween! Treat yourself to meryenda.','Trick or treat? Tap me for the menu!','Psst... try tapping the pumpkins!']
const HALLOWEEN_LINES={carved:['Boo!','Hehehe!','Boo! Did I scare you?'],plain:['Trick or treat!','Here, have a treat!'],bat:['Squeak!','Eek!']}
const GUIDE_WAITING_LINES=["Today's menu is still cooking!",'The menu will be posted soon!','Staff are planning a tasty menu...']
function guideLine(items:string[]|null,previous:string){
  const item=()=>{const name=items![Math.floor(Math.random()*items!.length)]!;return name.length>18?`${name.slice(0,17).trimEnd()}…`:name}
  const random=(lines:string[])=>lines[Math.floor(Math.random()*lines.length)]!
  const general=isHalloweenSeason()?[...GUIDE_LINES,...HALLOWEEN_GUIDE_LINES]:GUIDE_LINES
  // A few tries so the same sentence is rarely said twice in a row.
  for(let i=0;i<5;i++){
    const line=items&&!items.length?random(GUIDE_WAITING_LINES):items&&Math.random()<.5?random(GUIDE_ITEM_LINES).replace('{item}',item()):random(general)
    if(line!==previous)return line
  }
  return random(GUIDE_LINES)
}
// Halloween decorations stay up through Undas (Nov 1-2), on the store's Manila calendar.
function isHalloweenSeason(now=new Date()){
  const [month,day]=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Manila',month:'numeric',day:'numeric'}).format(now).split('/').map(Number)
  return month===10||(month===11&&day!<=2)
}
const menuGuideStops=[{x:120,y:440},{x:160,y:300},{x:200,y:280},{x:280,y:420},{x:220,y:530},{x:200,y:400},{x:230,y:540}]
function bounded(x:number,y:number){return Math.max(20,Math.min(340,x))>=20&&x>=20&&x<=340&&y>=260&&y<=542&&!obstructions.some(r=>r.contains(x,y))}
function closestPoint(x:number,y:number){const a=Math.max(20,Math.min(340,x)),b=Math.max(260,Math.min(542,y));if(bounded(a,b))return {x:a,y:b};return {x:180,y:500}}
function key(x:number,y:number){return `${x}|${y}`}
function pathFind(start:Phaser.Math.Vector2,target:Phaser.Math.Vector2){
  const toGrid=(p:Phaser.Math.Vector2)=>({x:Math.round(p.x/CELL),y:Math.round(p.y/CELL)})
  const startGrid=toGrid(start),targetGrid=toGrid(target)
  const allowed=(x:number,y:number)=>bounded(x*CELL,y*CELL)
  if(!allowed(targetGrid.x,targetGrid.y))return []
  const q=[startGrid],seen=new Set([key(startGrid.x,startGrid.y)]),prev=new Map<string,string>()
  const dirs=[[1,0],[-1,0],[0,1],[0,-1]] as const
  for(let i=0;i<q.length;i++){
    const c=q[i]!;if(c.x===targetGrid.x&&c.y===targetGrid.y)break
    for(const [dx,dy] of dirs){const nx=c.x+dx,ny=c.y+dy,k=key(nx,ny)
      if(!seen.has(k)&&allowed(nx,ny)){seen.add(k);prev.set(k,key(c.x,c.y));q.push({x:nx,y:ny})}}
  }
  const end=key(targetGrid.x,targetGrid.y)
  if(!seen.has(end))return []
  const seq:Phaser.Math.Vector2[]=[];let current=end
  while(current!==key(startGrid.x,startGrid.y)){
    const [x,y]=current.split('|').map(Number) as [number,number];seq.push(new Phaser.Math.Vector2(x*CELL,y*CELL));current=prev.get(current)!}
  return seq.reverse()
}

// Ink bounds of rendered text, measured once per font and line so padding hugs the letters, not the line box.
let measureContext:CanvasRenderingContext2D|null|undefined
function inkExtent(font:string,line:string){
  measureContext??=document.createElement('canvas').getContext('2d')
  if(!measureContext)return undefined
  measureContext.font=font
  const metrics=measureContext.measureText(line||' ')
  return {above:metrics.actualBoundingBoxAscent,below:metrics.actualBoundingBoxDescent}
}
// A cream speech-tag with a small tail and a thin brown edge. (x,y) is the tail tip, so tags sit just above a sprite.
class Tag extends Phaser.GameObjects.Container{
  private bg:Phaser.GameObjects.Graphics
  private label:Phaser.GameObjects.Text
  constructor(scene:Phaser.Scene,x:number,y:number,text:string,style:{size?:number;color?:string;wrap?:number;resolution:number}){
    super(scene,x,y)
    this.bg=new Phaser.GameObjects.Graphics(scene)
    this.label=new Phaser.GameObjects.Text(scene,0,0,text,{fontFamily:FONT,fontSize:`${style.size??TAG_FONT}px`,color:style.color??'#24160d',align:'center',resolution:style.resolution,
      wordWrap:style.wrap?{width:style.wrap,useAdvancedWrap:true}:undefined}).setOrigin(.5,0)
    this.add([this.bg,this.label]);scene.add.existing(this);this.redraw()
  }
  get text(){return this.label.text}
  setText(value:string){this.label.setText(value);this.redraw();return this}
  private redraw(){
    // Center the letters themselves: equal space above the tallest glyph and below the baseline.
    const lines=this.label.getWrappedText(this.label.text),metrics=this.label.style.getTextMetrics(),font=`${this.label.style.fontSize} ${FONT}`
    const first=inkExtent(font,lines[0]??''),last=inkExtent(font,lines[lines.length-1]??'')
    const inkTop=first?metrics.ascent-first.above:0
    const inkBottom=last?(lines.length-1)*(metrics.fontSize+this.label.lineSpacing)+metrics.ascent+last.below:this.label.height
    const w=Math.ceil((this.label.width+10)/PX)*PX,h=Math.ceil((inkBottom-inkTop+TAG_PAD_Y*2)/PX)*PX,left=-Math.round(w/2/PX)*PX,top=-h-4
    this.label.setPosition(left+w/2,top+(h-(inkBottom-inkTop))/2-inkTop)
    const shape=(grow:number)=>this.bg.fillRect(left+PX-grow,top-grow,w-PX*2+grow*2,h+grow*2).fillRect(left-grow,top+PX-grow,w+grow*2,h-PX*2+grow*2)
      .fillRect(-PX*2-grow,-4,PX*2+grow*2,PX+grow).fillRect(-PX-grow,-2,PX+grow*2,PX+grow)
    this.bg.clear().fillStyle(0x6b4630,.35).fillRect(left+PX,top+PX+1,w,h)
    this.bg.fillStyle(0x8a6446);shape(1)
    this.bg.fillStyle(0xfffcf4);shape(0)
  }
}

class StoreScene extends Phaser.Scene {
  private opts:Options
  private zoom:number
  private self?:VisitorCharacter
  private remotes=new Map<string,VisitorCharacter>()
  private staff:Character[]=[]
  private menuGuide?:VisitorCharacter
  private menuGuidePath:Phaser.Math.Vector2[]=[]
  private menuGuideStop=0
  private menuGuidePauseUntil=0
  private guideBubble?:Tag
  private guideBubbleTimer?:Phaser.Time.TimerEvent
  private guideNextBubbleAt=0
  private lastGuideLine=''
  private menuItems:string[]|null=null
  private direction=new Phaser.Math.Vector2(0,0)
  private path:Phaser.Math.Vector2[]=[]
  private afterPath?:()=>void
  private keys?:Record<string,Phaser.Input.Keyboard.Key>
  private lastMove=0
  private lastX=180
  private lastY=510
  private selfId=''
  private selfBubble?:Tag|Phaser.GameObjects.Image
  private cashier?:Phaser.GameObjects.Image
  private cashierBubble?:Tag
  private cashierBubbleTimer?:Phaser.Time.TimerEvent
  private cookingEffects?:Phaser.GameObjects.Graphics
  private cookingFrame=-2
  private boardLatest:{text:Phaser.GameObjects.Text;width:number}[]=[]
  private boardDeliveries:Phaser.GameObjects.Text[]=[]
  private cats:ShopCat[]=[]
  private catHeart?:Phaser.GameObjects.Graphics
  private catHeartFrame=-2
  private lastMeowAt=-Infinity
  private yarnSprite?:Phaser.GameObjects.Image
  private fixer?:Phaser.GameObjects.Image
  private fixerDust?:Phaser.GameObjects.Graphics
  private fixerPauseUntil=0
  private fixerBubble?:Tag
  private fixerBubbleTimer?:Phaser.Time.TimerEvent
  private mascot?:ReturnType<typeof createLocalMascot>
  private jukebox?:Phaser.GameObjects.Image
  private jukeboxNotes:Phaser.GameObjects.Image[]=[]
  private jukeboxState:JukeboxScene={playing:false,audible:false}
  // Tappable Halloween decorations. Times are scene time; flaredUntil/flyingSince drive their reactions.
  private pumpkins:{sprite:Phaser.GameObjects.Image;y:number;carved:boolean;tappedAt:number;flaredUntil:number}[]=[]
  private bats:{sprite:Phaser.GameObjects.Image;x:number;y:number;inward:1|-1;flyingSince:number}[]=[]
  private decorBubble?:Tag
  private decorBubbleTimer?:Phaser.Time.TimerEvent
  private draggingYarn?:{pointerId:number;lastX:number;lastY:number;lastAt:number;previousX:number;previousY:number;previousAt:number}
  constructor(opts:Options){super('Store');this.opts=opts;this.zoom=opts.zoom??1;if(opts.catEnabled!==false)this.mascot=createLocalMascot()}
  private texture(name:string,pixels:art.PixelArt){if(!this.textures.exists(name))this.textures.addCanvas(name,pixels.toCanvas())}
  private sprite(x:number,y:number,name:string,depth:number){return this.add.image(x,y,name).setScale(PX).setDepth(depth)}
  private text(x:number,y:number,value:string,size:number,color:string,depth:number){
    return this.add.text(x,y,value,{fontFamily:FONT,fontSize:`${size}px`,color,resolution:this.zoom}).setOrigin(.5).setDepth(depth)
  }
  private tag(x:number,y:number,value:string,size=TAG_FONT,wrap?:number){return new Tag(this,x,y,value,{size,wrap,resolution:this.zoom})}
  create(){
    this.cameras.main.setZoom(this.zoom).centerOn(W/2,H/2).setBackgroundColor('#6e4a31')
    this.createTextures()
    // Room shell: walls, awning, sign board, kitchen nook, chalkboard frame and tiled floor.
    this.add.image(0,0,'room').setOrigin(0).setScale(PX).setDepth(0)
    const sign=this.text(207,38,'CHITS STORE',16,'#fff3d6',2).setStroke('#fff3d6',1).setShadow(0,2,'#4b301f',0,false,true)
    this.sprite(sign.x+sign.width/2+16,36,'sparkle',2)
    this.sprite(sign.x-sign.width/2-26,48,'head-palitaw',2)
    this.text(207,58,'INSIDE THE MERYENDA HUB',8,'#f6e3c0',2)
    this.text(104,87,'KITCHEN',8,'#fff0d2',2)
    // Live orders chalkboard
    // Chalk text gets a dark under-edge so it stays readable at phone size.
    const chalk=(x:number,y:number,value:string,color:string,originX:number,size=9)=>this.add.text(x,y,value,{fontFamily:FONT,fontSize:`${size}px`,color,resolution:this.zoom})
      .setShadow(0,1,'#0b1a13',0,false,true).setOrigin(originX,.5).setDepth(2)
    chalk(207,89,'LIVE ORDERS','#fff6e2',0,11)
    // Preparing and Ready show their newest order beside the label; deliveries list below.
    for(const [label,color,y] of [['Preparing','#ffd45e',107],['Ready','#a9ec8f',118]] as const){
      const heading=chalk(207,y,label,'#fff6e2',0)
      this.boardLatest.push({text:chalk(331,y,'',color,1),width:331-(heading.x+heading.width+6)})
    }
    chalk(207,131,'Out for Delivery','#fff6e2',0)
    this.boardDeliveries=[0,1,2,3,4].map(i=>chalk(209,141+i*9.5,'',i?'#fff6e2':'#ffd45e',0))
    this.setBoard([])
    // Kitchen and order counter. Staff stand between the counters so the front one hides their legs.
    this.add.image(18,182,'kitchen-counter').setOrigin(0).setScale(PX).setDepth(120)
    this.sprite(30,176,'plant-small',121)
    this.add.image(64,206,'order-counter').setOrigin(0).setScale(PX).setDepth(200)
    this.text(184,236,'ORDER COUNTER',8,'#fff0d2',201)
    this.sprite(122,196,'register',205)
    this.sprite(256,202,'clipboard',205)
    this.sprite(280,197,'plant-small',205)
    const halloween=isHalloweenSeason()
    const pumpkin=(sprite:Phaser.GameObjects.Image,carved:boolean)=>this.pumpkins.push({sprite,y:sprite.y,carved,tappedAt:-Infinity,flaredUntil:0})
    if(halloween)pumpkin(this.sprite(226,200,'pumpkin-glow',205),true)
    this.jukebox=this.sprite(JUKEBOX.x,JUKEBOX.y,'jukebox-idle',JUKEBOX.depth)
    // Three reused notes; they show only while this visitor is listening.
    this.jukeboxNotes=[0,1,2].map(()=>this.sprite(JUKEBOX.x,JUKEBOX.y,'music-note',640).setVisible(false))
    // Floor furniture: depth follows each object's base so visitors walk in front and behind.
    const floor=(x:number,y:number,name:string)=>{const image=this.sprite(x,y,name,0);image.setDepth(y+image.displayHeight/2-14);return image}
    const board=floor(324,492,'feedback-board')
    this.text(324,465,'FEEDBACK',8,'#5e3d27',board.depth+1)
    this.text(324,509,'WRITE',8,'#5e3d27',board.depth+1)
    // Tile-repair corner: a handyman taps a fresh tile into place beside his toolbox.
    this.sprite(110,410,'repair-tile',1);this.sprite(136,418,'old-tile',2)
    floor(54,410,'toolbox');floor(140,388,'cone')
    this.fixer=floor(84,392,'fixer-rest')
    this.fixerDust=this.add.graphics().setDepth(this.fixer.depth+1)
    this.sprite(180,564,'entrance',1000)
    this.text(180,559,'ENTRANCE',8,'#5e3d27',1001)
    // A few Halloween touches: pumpkins either side of the door and two bats by the sign.
    if(halloween){
      pumpkin(floor(104,536,'pumpkin-glow'),true);pumpkin(floor(256,536,'pumpkin'),false)
      this.bats=([[34,46,1],[330,44,-1]] as const).map(([x,y,inward])=>({sprite:this.sprite(x,y,'bat-up',3),x,y,inward,flyingSince:-Infinity}))
    }
    const chef=this.sprite(98,160,'chef',100)
    this.cookingEffects=this.add.graphics().setDepth(101)
    this.updateChefCooking()
    const cashier=this.sprite(184,186,'cashier',150)
    this.cashier=cashier
    this.staff=[{sprite:chef,avatar:'chef',phase:characterPhase('chef')},{sprite:cashier,avatar:'cashier',phase:characterPhase('cashier')}]
    // Enter beside the visitor so the sprites and name tags stay separate.
    if(this.opts.guideEnabled!==false){
      const guideSprite=this.sprite(this.opts.reducedMotion?120:270,this.opts.reducedMotion?440:540,'menu-guide',550)
      const guideLabel=this.tag(guideSprite.x,guideSprite.y-NAME_TAG_GAP,'MENU · TAP').setDepth(tagDepth(guideSprite.y))
      this.menuGuide={sprite:guideSprite,label:guideLabel,avatar:'menu-guide',phase:characterPhase('menu-guide'),movingUntil:0}
      this.menuGuidePauseUntil=this.time.now+1100
      this.guideNextBubbleAt=this.time.now+4000+Math.random()*3000
    }
    const sprite=this.sprite(180,510,this.opts.avatar,520)
    const label=this.tag(180,510-NAME_TAG_GAP,this.opts.nickname).setDepth(tagDepth(510))
    this.self={sprite,label,avatar:this.opts.avatar,phase:characterPhase(this.opts.nickname),movingUntil:0}
    if(this.mascot){
      for(const cat of this.mascot.snapshot(0).cats){
        const skin=CAT_SKINS[cat.name],roams=residentCats.find(resident=>resident.name===cat.name)?.roams!==false
        const sprite=this.sprite(cat.x,cat.y+10,`${skin}-${cat.mood==='sleeping'?'sleep':'sit'}`,cat.y+12).setOrigin(.5,1)
        this.cats.push({name:cat.name,roams,sprite,skin,label:this.tag(cat.x,cat.y-36,cat.name.toUpperCase()).setDepth(tagDepth(cat.y))})
      }
      this.catHeart=this.add.graphics()
      this.yarnSprite=this.sprite(204,474,'yarn-ball',450)
    }
    if(this.input.keyboard){
      // Global capture prevents native typing even when update() ignores focused inputs.
      this.keys=this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT',false) as Record<string,Phaser.Input.Keyboard.Key>
      this.input.keyboard.on('keydown',(event:KeyboardEvent)=>{
        if(this.inputBlocked()||event.isComposing){this.input.keyboard?.resetKeys();return}
        if(event.key.startsWith('Arrow')&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey)event.preventDefault()
      })
    }
    this.setControlsEnabled(this.opts.controlsEnabled!==false)
    this.input.on('pointerdown',(pointer:Phaser.Input.Pointer)=>{
      if(this.inputBlocked())return
      const x=pointer.worldX,y=pointer.worldY
      // The guide can cross the yarn's tile; keep its menu hit target reliable there.
      if(this.menuGuide&&Math.abs(x-this.menuGuide.sprite.x)<24&&Math.abs(y-this.menuGuide.sprite.y)<30){
        this.menuGuidePath=[];this.menuGuidePauseUntil=this.time.now+3500;this.menuGuide.sprite.setTint(0xffecc2);this.clearGuideBubble();this.tapFeedback(x,y);this.opts.onInteract('menu');return
      }
      if(this.yarnSprite&&Math.hypot(x-this.yarnSprite.x,y-this.yarnSprite.y)<24&&this.mascot?.pickup()){
        const now=this.time.now
        this.draggingYarn={pointerId:pointer.id,lastX:x,lastY:y,lastAt:now,previousX:x,previousY:y,previousAt:now}
        return
      }
      // The front-most cat wins when the two overlap.
      const tappedCat=[...this.cats].sort((a,b)=>b.sprite.y-a.sprite.y).find(({sprite})=>Math.abs(x-sprite.x)<27&&y>sprite.y-sprite.displayHeight-4&&y<sprite.y+4)
      if(tappedCat){this.tapFeedback(x,y);const result=this.petCat(tappedCat.name);if(result!=='petted')this.meow(tappedCat.name);return}
      // Tapping the handyman makes him stop work and apologise for the renovation.
      if(this.fixer&&Math.abs(x-this.fixer.x)<26&&Math.abs(y-this.fixer.y)<26){this.tapFeedback(x,y);this.fixerSpeak();return}
      // Halloween decorations react on the spot, before the counter and board areas behind them.
      const tappedPumpkin=this.pumpkins.find(({sprite})=>Math.abs(x-sprite.x)<18&&Math.abs(y-sprite.y)<16)
      if(tappedPumpkin){this.tapFeedback(x,y);this.tapPumpkin(tappedPumpkin);return}
      const tappedBat=this.bats.find(({sprite})=>Math.abs(x-sprite.x)<20&&Math.abs(y-sprite.y)<14)
      if(tappedBat){this.tapFeedback(x,y);this.tapBat(tappedBat);return}
      const interact=(tx:number,ty:number,kind:string)=>{this.tapFeedback(x,y);this.walkTo(tx,ty,()=>this.opts.onInteract(kind))}
      if(this.jukebox&&Math.abs(x-this.jukebox.x)<28&&y>=this.jukebox.y-34&&y<=this.jukebox.y+36){interact(JUKEBOX.standX,JUKEBOX.standY,'jukebox');return}
      if(x>=192&&y<200){interact(220,260,'board');return}
      if(x<190&&y<200){interact(93,273,'chef');return}
      if(y<256&&x>=60&&x<=304){interact(177,273,'cashier');return}
      if(feedbackArea.contains(x,y)){interact(260,500,'feedback');return}
      if(y>=548&&x>=126&&x<=234){interact(180,540,'leave');return}
      const p=closestPoint(x,y);this.tapFeedback(p.x,p.y);this.walkTo(p.x,p.y)
    })
    this.input.on('pointermove',(pointer:Phaser.Input.Pointer)=>this.dragYarn(pointer))
    this.input.on('pointerup',(pointer:Phaser.Input.Pointer)=>this.releaseYarn(pointer))
    this.input.on('pointerupoutside',(pointer:Phaser.Input.Pointer)=>this.releaseYarn(pointer))
  }
  private createTextures(){
    this.texture('room',art.roomArt())
    for(const option of avatarOptions)this.createVisitorTextures(option.id)
    if(this.opts.guideEnabled!==false)this.createVisitorTextures('menu-guide')
    this.texture('chef',art.chefArt());this.texture('chef-blink',art.chefArt(true))
    this.texture('cashier',art.staffArt());this.texture('cashier-blink',art.staffArt(true))
    this.texture('head-palitaw',art.headArt('palitaw'));this.texture('sparkle',art.sparkleArt())
    this.texture('kitchen-counter',art.kitchenCounterArt());this.texture('order-counter',art.orderCounterArt())
    this.texture('register',art.registerArt());this.texture('clipboard',art.clipboardArt())
    this.texture('plant-small',art.smallPlantArt())
    for(const frame of ['up','down','rest'] as const)this.texture(`fixer-${frame}`,art.fixerArt(frame))
    this.texture('toolbox',art.toolboxArt());this.texture('cone',art.coneArt());this.texture('repair-tile',art.repairTileArt());this.texture('old-tile',art.oldTileArt())
    this.texture('feedback-board',art.feedbackBoardArt());this.texture('entrance',art.entranceArt())
    this.texture('jukebox-idle',art.jukeboxArt('idle'));for(const frame of [0,1,2,3] as const)this.texture(`jukebox-${frame}`,art.jukeboxArt(frame))
    this.texture('music-note',art.musicNoteArt())
    if(isHalloweenSeason()){
      this.texture('pumpkin',art.pumpkinArt());this.texture('pumpkin-glow',art.pumpkinArt('glow'));this.texture('pumpkin-flicker',art.pumpkinArt('flicker'));this.texture('pumpkin-bright',art.pumpkinArt('bright'))
      this.texture('bat-up',art.batArt('up'));this.texture('bat-down',art.batArt('down'))
      this.texture('ghost',art.ghostArt());this.texture('candy',art.candyArt())
    }
    for(const reaction of reactionOptions){
      const pixels=new art.PixelArt(20,20)
      pixels.rect(0,1,20,18,'#674731').rect(1,0,18,20,'#674731').rect(1,1,18,18,'#fff3da')
      for(const [x,y,width,height,color] of reaction.pixels)pixels.rect(2+x,2+y,width,height,`#${color.toString(16).padStart(6,'0')}`)
      this.texture(`reaction-${reaction.id}`,pixels)
    }
    if(this.mascot){
      for(const name of Object.keys(CAT_SKINS) as CatName[])for(const [frame,pose] of CAT_POSES)this.texture(`${CAT_SKINS[name]}-${frame}`,art.catArt(pose,art.CAT_COATS[name]))
      this.texture('yarn-ball',art.yarnArt());this.texture('yarn-ball-roll',art.yarnArt(true))
    }
  }
  private createVisitorTextures(id:Parameters<typeof art.visitorArt>[0]){
    this.texture(id,art.visitorArt(id,'idle'));this.texture(`${id}-blink`,art.visitorArt(id,'blink'))
    this.texture(`${id}-step1`,art.visitorArt(id,'step1'));this.texture(`${id}-step2`,art.visitorArt(id,'step2'))
  }
  // Four small pixel sparks: confirms a tap without moving the camera or adding lasting effects.
  private tapFeedback(x:number,y:number){
    if(this.opts.reducedMotion)return
    const spark=this.add.graphics({x:Math.round(x/PX)*PX,y:Math.round(y/PX)*PX}).setDepth(950)
    const progress={value:0}
    this.tweens.add({targets:progress,value:1,duration:260,onUpdate:()=>{
      const d=Math.round(2+progress.value*4)*PX/2
      spark.clear().fillStyle(0xfff6dc,1-progress.value).fillRect(-d-PX,-PX/2,PX,PX).fillRect(d,-PX/2,PX,PX).fillRect(-PX/2,-d-PX,PX,PX).fillRect(-PX/2,d,PX,PX)
    },onComplete:()=>spark.destroy()})
  }
  setBoard(orders:BoardOrder[]){
    // "number · name", shortening the staff-entered name until the line fits on the chalkboard.
    const write=(text:Phaser.GameObjects.Text,order:BoardOrder|undefined,width:number)=>{
      if(!order){text.setText('—').setAlpha(.6);return}
      const full=Array.from(order.name||'')
      let name=full.slice(0,12)
      const line=()=>`${order.number}${name.length?` · ${name.join('')}${name.length<full.length?'…':''}`:''}`
      text.setText(line()).setAlpha(1)
      while(text.width>width&&name.length){name=name.slice(0,-1);text.setText(line())}
    }
    // The public feed is newest first: one Preparing, one Ready, and up to five deliveries.
    write(this.boardLatest[0]!.text,orders.find(o=>o.status==='Preparing'),this.boardLatest[0]!.width)
    write(this.boardLatest[1]!.text,orders.find(o=>o.status==='Ready'),this.boardLatest[1]!.width)
    const deliveries=orders.filter(o=>o.status==='Served').slice(0,5)
    this.boardDeliveries.forEach((text,i)=>{if(deliveries[i]||!i)write(text,deliveries[i],120);else text.setText('')})
  }
  tossYarn(){return this.mascot?.toss(this.time.now)??false}
  private nearestCat(){
    const self=this.self?.sprite
    return this.cats.reduce<ShopCat|undefined>((best,cat)=>!best||!self||Math.hypot(cat.sprite.x-self.x,cat.sprite.y-self.y)<Math.hypot(best.sprite.x-self.x,best.sprite.y-self.y)?cat:best,undefined)?.name
  }
  petCat(name?:CatName){
    const target=name??this.nearestCat()
    const result=this.mascot?.pet({x:this.self?.sprite.x??180,y:this.self?.sprite.y??510},this.time.now,target)??'busy'
    if(result==='petted'&&target)this.meow(target)
    return result
  }
  // Sound only: the cat's tag already shows the purr (MIMING ♥) while being petted.
  private meow(name:CatName){
    if(!this.cats.length||this.time.now-this.lastMeowAt<1200)return
    this.lastMeowAt=this.time.now
    this.opts.onCatMeow(name)
  }
  private updateMascot(delta:number){
    if(!this.mascot)return
    this.mascot.tick(this.time.now,delta)
    const snapshot=this.mascot.snapshot(this.time.now),ball=this.yarnSprite,motion=!this.opts.reducedMotion
    if(!ball)return
    snapshot.cats.forEach((state,i)=>{const view=this.cats[i];if(view)this.drawCat(view,state,motion)})
    this.spreadCatLabels()
    this.updateCatHeart(snapshot.cats,motion)
    ball.setPosition(snapshot.yarn.x,snapshot.yarn.y)
    setDepthIfChanged(ball,ball.y+12)
    const rolling=motion&&snapshot.yarn.moving&&Math.floor(this.time.now/90)%2?'yarn-ball-roll':'yarn-ball'
    if(ball.texture.key!==rolling)ball.setTexture(rolling)
  }
  private drawCat({name,roams,sprite:cat,label,skin}:ShopCat,state:CatSnapshot,motion:boolean){
    const mood=state.mood,now=this.time.now
    const walking=mood==='walking'||mood==='approaching_yarn'||mood==='returning_to_idle'
    const running=mood==='visiting'
    // When snuggling, Miming sits and flicks its tail slowly while Onay stands beside it.
    const pose=walking||running?(motion&&Math.floor(now/180)%2?'walk':'idle'):mood==='idle'?'idle':
      mood==='sleeping'?'sleep':mood==='resting'?'rest':mood==='stretching'?'stretch':mood==='noticing_yarn'?'notice':
      mood==='playing_with_yarn'?(motion&&Math.floor(now/160)%2?'play':'idle'):
      mood==='snuggling'?(!roams?'idle':motion&&Math.floor(now/700)%2?'notice':'sit'):'sit'
    const texture=`${skin}-${pose}`
    if(cat.texture.key!==texture)cat.setTexture(texture)
    // Standing art faces left, so flip when the cat heads right.
    cat.setFlipX(state.facing>0&&(walking||running||mood==='playing_with_yarn'||mood==='noticing_yarn'||mood==='snuggling'))
    const purr=state.purring&&motion&&Math.floor(now/220)%2?PX/2:0
    cat.setPosition(state.x,state.y+10-purr)
    setDepthIfChanged(cat,cat.y+2);label.setPosition(cat.x,cat.y-cat.displayHeight-1);setDepthIfChanged(label,tagDepth(cat.y))
    const tag=name.toUpperCase()
    const caption=state.purring?`${tag} ♥`:mood==='sleeping'?`${tag} zZ`:mood==='noticing_yarn'?`${tag} !`:tag
    if(label.text!==caption)label.setText(caption)
  }
  // Two cats side by side would stack their name tags; slide the tags apart instead.
  private spreadCatLabels(){
    const [a,b]=this.cats
    if(!a||!b)return
    const dx=b.label.x-a.label.x,overlap=58-Math.abs(dx)
    if(overlap<=0||Math.abs(b.label.y-a.label.y)>16)return
    const shift=overlap/2*(dx>=0?1:-1)
    a.label.x-=shift;b.label.x+=shift
  }
  // A small pixel heart floats above the two name tags while the cats snuggle. Redrawn only on a new frame.
  private updateCatHeart(cats:CatSnapshot[],motion:boolean){
    const heart=this.catHeart
    if(!heart)return
    const snuggling=cats.filter(cat=>cat.mood==='snuggling')
    const frame=snuggling.length===2?(motion?Math.floor(this.time.now/450)%2:0):-1
    if(frame>=0){const [a,b]=snuggling as [CatSnapshot,CatSnapshot];heart.setPosition(Math.round((a.x+b.x)/2/PX)*PX,Math.round((Math.min(a.y,b.y)-62)/PX)*PX);setDepthIfChanged(heart,tagDepth(Math.max(a.y,b.y))+1)}
    if(frame===this.catHeartFrame)return
    this.catHeartFrame=frame
    heart.clear()
    if(frame<0)return
    const lift=frame?-PX:0
    // ##.## / ##### / .###. / ..#.. on a 5-wide grid centred on the position.
    for(const [col,row,width] of [[0,0,2],[3,0,2],[0,1,5],[1,2,3],[2,3,1]] as const)heart.fillStyle(0xef7f95).fillRect((col-2.5)*PX,row*PX+lift,width*PX,PX)
    heart.fillStyle(0xffd3dc).fillRect(-2*PX,lift+PX/2,PX/2,PX/2)
  }
  private dragYarn(pointer:Phaser.Input.Pointer){
    const drag=this.draggingYarn
    if(!drag||drag.pointerId!==pointer.id||this.inputBlocked())return
    const x=pointer.worldX,y=pointer.worldY
    if(!mascotFloorPoint(x,y,6))return
    const now=this.time.now
    if(Math.hypot(x-drag.lastX,y-drag.lastY)>1){drag.previousX=drag.lastX;drag.previousY=drag.lastY;drag.previousAt=drag.lastAt;drag.lastX=x;drag.lastY=y;drag.lastAt=now}
    this.mascot?.drag(x,y,now)
    this.yarnSprite?.setPosition(x,y)
  }
  private releaseYarn(pointer:Phaser.Input.Pointer){
    const drag=this.draggingYarn
    if(!drag||drag.pointerId!==pointer.id)return
    this.draggingYarn=undefined
    const x=mascotFloorPoint(pointer.worldX,pointer.worldY,6)?pointer.worldX:drag.lastX
    const y=mascotFloorPoint(pointer.worldX,pointer.worldY,6)?pointer.worldY:drag.lastY
    const elapsed=Math.max(30,drag.lastAt-drag.previousAt),recent=this.time.now-drag.lastAt<140
    const vx=recent?(drag.lastX-drag.previousX)/elapsed*700:0,vy=recent?(drag.lastY-drag.previousY)/elapsed*700:0
    this.mascot?.release(x,y,vx,vy,this.time.now)
  }
  walkTo(x:number,y:number,callback?:()=>void){if(!this.self||this.inputBlocked())return;this.path=pathFind(new Phaser.Math.Vector2(this.self.sprite.x,this.self.sprite.y),new Phaser.Math.Vector2(x,y));this.afterPath=callback
    // Already standing on the target tile: there is no path to walk, so interact right away.
    if(!this.path.length&&callback&&Math.hypot(this.self.sprite.x-Math.round(x/CELL)*CELL,this.self.sprite.y-Math.round(y/CELL)*CELL)<CELL){this.afterPath=undefined;callback()}}
  setDirection(x:number,y:number){if(this.inputBlocked()){this.resetMovement();return}this.direction.set(x,y);if(x||y){this.path=[];this.afterPath=undefined}}
  private inputBlocked(){
    const active=document.activeElement
    return this.opts.controlsEnabled===false||Boolean(document.querySelector('dialog[open]'))||
      (active instanceof HTMLElement&&(active.isContentEditable||Boolean(active.closest('input,textarea,select,[role="textbox"]'))))
  }
  private resetMovement(){this.direction.set(0,0);this.path=[];this.afterPath=undefined;this.input?.keyboard?.resetKeys()}
  setControlsEnabled(value:boolean){
    if(!value&&this.draggingYarn){const d=this.draggingYarn;this.draggingYarn=undefined;this.mascot?.release(d.lastX,d.lastY,0,0,this.time.now)}
    this.opts.controlsEnabled=value;this.resetMovement();if(value)this.menuGuide?.sprite.clearTint();if(this.input?.keyboard)this.input.keyboard.enabled=value
  }
  setReducedMotion(value:boolean){this.opts.reducedMotion=value;this.cookingFrame=-2}
  // Frame swaps and whole-pixel lifts only: pixel art is never rotated or squashed.
  private animateCharacter(character:Character,moving:boolean){
    const {sprite,avatar,phase}=character
    let texture=avatar,lift=0
    if(!this.opts.reducedMotion){
      const time=this.time.now+phase
      if(moving){const step=Math.floor(time/130)%4;lift=step%2?PX:0;if(step===1)texture=`${avatar}-step1`;if(step===3)texture=`${avatar}-step2`}
      else{lift=Math.floor(time/900)%2?PX/2:0;if(time%(3800+phase%1800)<130)texture=`${avatar}-blink`}
      if(!this.textures.exists(texture))texture=avatar
    }
    if(sprite.texture.key!==texture)sprite.setTexture(texture)
    // Animate only the artwork: x/y remain the collision and network coordinates.
    sprite.setOrigin(.5,.5+lift/sprite.displayHeight)
  }
  private moveMenuGuide(delta:number){
    const guide=this.menuGuide
    if(!guide)return
    let moving=false
    if(this.opts.controlsEnabled!==false&&!this.opts.reducedMotion&&this.time.now>=this.menuGuidePauseUntil){
      if(!this.menuGuidePath.length){
        const stop=menuGuideStops[this.menuGuideStop%menuGuideStops.length]!
        this.menuGuideStop++
        this.menuGuidePath=pathFind(new Phaser.Math.Vector2(guide.sprite.x,guide.sprite.y),new Phaser.Math.Vector2(stop.x,stop.y))
        if(!this.menuGuidePath.length)this.menuGuidePauseUntil=this.time.now+1800
      }
      const next=this.menuGuidePath[0]
      if(next){
        const distance=Phaser.Math.Distance.Between(guide.sprite.x,guide.sprite.y,next.x,next.y)
        const step=Math.min(delta,50)/1000*36
        if(distance<=step){guide.sprite.setPosition(next.x,next.y);this.menuGuidePath.shift();if(!this.menuGuidePath.length)this.menuGuidePauseUntil=this.time.now+1800+Math.random()*1800}
        else{guide.sprite.x+=(next.x-guide.sprite.x)/distance*step;guide.sprite.y+=(next.y-guide.sprite.y)/distance*step;moving=true}
      }
    }
    this.animateCharacter(guide,moving)
    guide.label.setPosition(guide.sprite.x,guide.sprite.y-NAME_TAG_GAP)
    setDepthIfChanged(guide.sprite,guide.sprite.y+10);setDepthIfChanged(guide.label,tagDepth(guide.sprite.y))
    // The bubble rides along above the MENU tag; a new one waits while a dialog is open.
    if(this.guideBubble)this.guideBubble.setPosition(guide.sprite.x,guide.sprite.y-BUBBLE_GAP)
    else if(this.time.now>=this.guideNextBubbleAt&&this.opts.controlsEnabled!==false)this.guideSpeak()
  }
  setMenuItems(items:string[]|null){this.menuItems=items}
  private guideSpeak(){
    const guide=this.menuGuide
    if(!guide)return
    const line=guideLine(this.menuItems,this.lastGuideLine)
    this.lastGuideLine=line
    this.guideBubble=this.tag(guide.sprite.x,guide.sprite.y-BUBBLE_GAP,line,TAG_FONT,130).setDepth(900)
    this.guideBubbleTimer=this.time.delayedCall(4500,()=>this.clearGuideBubble())
  }
  // Removes the bubble and schedules the next one 12-22 seconds later.
  private clearGuideBubble(){
    this.guideBubbleTimer?.remove(false);this.guideBubbleTimer=undefined
    this.guideBubble?.destroy();this.guideBubble=undefined
    this.guideNextBubbleAt=this.time.now+12_000+Math.random()*10_000
  }
  private updateChefCooking(){
    const frame=this.opts.reducedMotion?-1:Math.floor(this.time.now/150)%16
    if(frame===this.cookingFrame||!this.cookingEffects)return
    this.cookingFrame=frame
    const fx=this.cookingEffects
    fx.clear()
    // The chef tosses the pan now and then; between tosses the filling just sizzles.
    const toss=frame>=12?[0,-4,-6,-2][frame-12]!:0
    const stir=frame<0?0:(frame%4<2?0:PX)
    const y=166+toss
    fx.fillStyle(0x3a2d28).fillRect(108,y+2,8,PX).fillRect(116,y,22,PX).fillRect(118,y+2,18,4)
    fx.fillStyle(0x5a4840).fillRect(118,y,18,PX)
    fx.fillStyle(0xf6c46d).fillRect(120+stir,y-2,6,PX).fillRect(128-stir,y-2,4,PX)
    fx.fillStyle(0x79a365).fillRect(126,y-2,PX,PX)
    if(frame>=0){
      for(let i=0;i<3;i++){
        const rise=((frame*2+i*6)%16)*PX/2
        fx.fillStyle(0xffffff,Math.max(0,.75-rise/24)).fillRect(120+i*6,156-rise,PX,4)
      }
    }else fx.fillStyle(0xffffff,.6).fillRect(122,154,PX,4).fillRect(132,150,PX,4)
  }
  private fixerSpeak(){
    const fixer=this.fixer
    if(!fixer)return
    this.fixerBubbleTimer?.remove(false)
    this.fixerBubble?.destroy()
    const bubble=this.tag(fixer.x,fixer.y-26,'Sorry for the inconvenience! We have an ongoing renovation.',TAG_FONT,150).setDepth(900)
    this.fixerBubble=bubble
    this.fixerPauseUntil=this.time.now+4000
    this.fixerBubbleTimer=this.time.delayedCall(4000,()=>{if(this.fixerBubble===bubble)this.fixerBubble=undefined;bubble.destroy();this.fixerBubbleTimer=undefined})
  }
  // Four quick hammer taps, then a pause to check the tile. Textures change only on a new frame.
  private updateFixer(){
    const fixer=this.fixer,dust=this.fixerDust
    if(!fixer||!dust)return
    const now=this.time.now,cycle=now%3400
    const frame=!this.opts.reducedMotion&&now>=this.fixerPauseUntil&&cycle<1600?(Math.floor(cycle/200)%2?'down':'up'):'rest'
    if(fixer.texture.key===`fixer-${frame}`)return
    fixer.setTexture(`fixer-${frame}`)
    dust.clear()
    if(frame==='down')dust.fillStyle(0xfff8ea,.85).fillRect(100,402,PX,PX).fillRect(114,400,PX,PX).fillRect(108,396,PX,PX)
  }
  setJukebox(state:JukeboxScene){this.jukeboxState=state}
  // Lights chase and the record's shine turns while a song is on; idle is one still frame.
  private updateJukebox(){
    const box=this.jukebox
    if(!box)return
    const {playing,audible}=this.jukeboxState,motion=!this.opts.reducedMotion
    const texture=!playing?'jukebox-idle':motion?`jukebox-${Math.floor(this.time.now/320)%4}`:'jukebox-0'
    if(box.texture.key!==texture)box.setTexture(texture)
    const notes=playing&&audible&&motion
    this.jukeboxNotes.forEach((note,i)=>{
      if(!notes){if(note.visible)note.setVisible(false);return}
      // Each note rises in whole pixels with a one-pixel sway, fading in fast and out slowly.
      const progress=((this.time.now+i*900)%2700)/2700
      note.setPosition(box.x+[-4,8,18][i]!+(Math.floor(progress*6)%2?PX:0),box.y-32-Math.round(progress*10)*PX)
        .setAlpha(progress<.15?progress/.15:Math.max(0,1-(progress-.15)/.85)).setVisible(true)
    })
  }
  // Candles flicker now and then and the bats flap with a one-pixel bob; still under reduced motion.
  // A tapped pumpkin hops, and a tapped bat swoops down in a loop and back to its spot.
  private updateHalloween(){
    const now=this.time.now,motion=!this.opts.reducedMotion
    this.pumpkins.forEach((pumpkin,i)=>{
      if(pumpkin.carved){
        const texture=now<pumpkin.flaredUntil?'pumpkin-bright':motion&&(now+i*1700)%2300<180?'pumpkin-flicker':'pumpkin-glow'
        if(pumpkin.sprite.texture.key!==texture)pumpkin.sprite.setTexture(texture)
      }
      const hop=(now-pumpkin.tappedAt)/260,y=pumpkin.y-(motion&&hop<1?Math.round(Math.sin(hop*Math.PI)*3)*PX:0)
      if(pumpkin.sprite.y!==y)pumpkin.sprite.setY(y)
    })
    this.bats.forEach((bat,i)=>{
      const flight=motion?(now-bat.flyingSince)/2400:1
      let x=bat.x,y=bat.y+(motion&&Math.floor((now+i*700)/1400)%2?PX:0)
      if(flight<1){
        // Out toward the middle dipping low, back along the top: a loop that stays inside the room.
        x=bat.x+bat.inward*Math.round(Math.sin(flight*Math.PI)*24)*PX
        const swoop=Math.sin(flight*Math.PI*2)
        y=bat.y+Math.round(swoop*(swoop>0?22:9))*PX
      }
      const up=!motion||Math.floor((now+i*170)/(flight<1?120:260))%2===0
      if(bat.sprite.texture.key!==(up?'bat-up':'bat-down'))bat.sprite.setTexture(up?'bat-up':'bat-down')
      if(bat.sprite.x!==x||bat.sprite.y!==y)bat.sprite.setPosition(x,y)
      setDepthIfChanged(bat.sprite,flight<1?640:3)
    })
  }
  private tapPumpkin(pumpkin:typeof this.pumpkins[number]){
    const now=this.time.now
    // One ghost or candy per hop, so quick repeated taps don't pile them up.
    if(now-pumpkin.tappedAt<900)return
    pumpkin.tappedAt=now
    if(pumpkin.carved)pumpkin.flaredUntil=now+900
    const bubble=this.decorSpeak(pumpkin.sprite.x,pumpkin.y-18,pumpkin.carved?HALLOWEEN_LINES.carved:HALLOWEEN_LINES.plain)
    if(this.opts.reducedMotion)return
    const {x}=pumpkin.sprite,y=pumpkin.y,depth=pumpkin.sprite.depth+1
    if(pumpkin.carved){
      // The ghost rises in whole pixels with a slow sway, then fades. It's the one saying "Boo!",
      // so the bubble rides just above it instead of covering it.
      const ghost=this.sprite(x,y-8,'ghost',depth).setAlpha(0),progress={value:0}
      this.tweens.add({targets:progress,value:1,duration:1600,onUpdate:()=>{
        const p=progress.value
        ghost.setPosition(x+Math.round(Math.sin(p*Math.PI*3)*2)*PX,y-8-Math.round(p*18)*PX).setAlpha(p<.15?p/.15*.9:.9*(1-(p-.15)/.85))
        if(this.decorBubble===bubble)bubble.setPosition(ghost.x,ghost.y-ghost.displayHeight/2-2)
      },onComplete:()=>ghost.destroy()})
    }else{
      // The candy pops out in an arc, lands on the floor beside the pumpkin and fades.
      const side=Math.random()<.5?-1:1,candy=this.sprite(x,y,'candy',depth),progress={value:0}
      this.tweens.add({targets:progress,value:1,duration:520,onUpdate:()=>{
        const p=progress.value
        candy.setPosition(x+side*Math.round(p*12)*PX,y-Math.round(Math.sin(p*Math.PI)*14-p*5)*PX)
      },onComplete:()=>this.tweens.add({targets:candy,alpha:0,delay:900,duration:400,onComplete:()=>candy.destroy()})})
    }
  }
  private tapBat(bat:typeof this.bats[number]){
    this.decorSpeak(bat.sprite.x,bat.sprite.y-10,HALLOWEEN_LINES.bat)
    if(this.time.now-bat.flyingSince>=2400)bat.flyingSince=this.time.now
  }
  private decorSpeak(x:number,y:number,lines:string[]){
    this.decorBubbleTimer?.remove(false)
    this.decorBubble?.destroy()
    const bubble=this.tag(x,y,lines[Math.floor(Math.random()*lines.length)]!).setDepth(900)
    this.decorBubble=bubble
    this.decorBubbleTimer=this.time.delayedCall(1800,()=>{if(this.decorBubble===bubble)this.decorBubble=undefined;bubble.destroy();this.decorBubbleTimer=undefined})
    return bubble
  }
  override update(_:number,delta:number){
    this.updateMascot(delta)
    this.updateFixer()
    this.updateJukebox()
    this.updateHalloween()
    for(const character of this.staff)this.animateCharacter(character,false)
    this.updateChefCooking()
    for(const character of this.remotes.values())this.animateCharacter(character,this.time.now<character.movingUntil)
    this.moveMenuGuide(delta)
    if(!this.self)return
    if(this.inputBlocked()){this.resetMovement();this.animateCharacter(this.self,false);return}
    const sprite=this.self.sprite
    const previousX=sprite.x,previousY=sprite.y
    let vx=this.direction.x,vy=this.direction.y
    if(this.keys){
      const k=this.keys;vx+=(k.A?.isDown||k.LEFT?.isDown?-1:0)+(k.D?.isDown||k.RIGHT?.isDown?1:0)
      vy+=(k.W?.isDown||k.UP?.isDown?-1:0)+(k.S?.isDown||k.DOWN?.isDown?1:0)
    }
    if(!vx&&!vy&&this.path.length){
      const p=this.path[0]!,diff=new Phaser.Math.Vector2(p.x-sprite.x,p.y-sprite.y)
      if(diff.length()<4){sprite.setPosition(p.x,p.y);this.path.shift();if(!this.path.length){const action=this.afterPath;this.afterPath=undefined;action?.()}}else{diff.normalize();vx=diff.x;vy=diff.y}
    }
    const length=Math.hypot(vx,vy)
    if(length){vx/=length;vy/=length;const s=Math.min(delta/1000,.05)*115
      if(bounded(sprite.x+vx*s,sprite.y))sprite.x+=vx*s
      if(bounded(sprite.x,sprite.y+vy*s))sprite.y+=vy*s
    }
    this.animateCharacter(this.self,Math.hypot(sprite.x-previousX,sprite.y-previousY)>.1)
    this.self.label.setPosition(sprite.x,sprite.y-NAME_TAG_GAP)
    this.positionBubble(this.selfBubble,sprite)
    setDepthIfChanged(sprite,sprite.y+10);setDepthIfChanged(this.self.label,tagDepth(sprite.y))
    if(this.time.now-this.lastMove>90&&Math.hypot(sprite.x-this.lastX,sprite.y-this.lastY)>1){
      this.lastMove=this.time.now;this.lastX=sprite.x;this.lastY=sprite.y;this.opts.onMove(Math.round(sprite.x),Math.round(sprite.y))
    }
  }
  setPlayers(players:Player[],selfId:string){
    if(selfId!==this.selfId&&this.self){
      const own=players.find(p=>p.id===selfId)
      if(own){this.self.sprite.setPosition(own.x,own.y);this.lastX=own.x;this.lastY=own.y;this.path=[];this.afterPath=undefined}
    }
    this.selfId=selfId
    const incoming=new Set(players.filter(p=>p.id!==selfId).map(p=>p.id))
    for(const [id,p] of this.remotes)if(!incoming.has(id)){p.sprite.destroy();p.label.destroy();p.bubble?.destroy();this.remotes.delete(id)}
    for(const p of players){if(p.id===selfId)continue
      let remote=this.remotes.get(p.id)
      if(!remote){
        const avatar=this.textures.exists(p.avatar)?p.avatar:'mochi'
        remote={sprite:this.sprite(p.x,p.y,avatar,p.y+10),label:this.tag(p.x,p.y-NAME_TAG_GAP,p.nickname).setDepth(tagDepth(p.y)),avatar,phase:characterPhase(p.id),movingUntil:0}
        this.remotes.set(p.id,remote)
      }
      this.movePlayer(p.id,p.x,p.y)
    }
  }
  movePlayer(id:string,x:number,y:number){
    const remote=this.remotes.get(id)
    if(!remote||Math.hypot(x-remote.sprite.x,y-remote.sprite.y)<=.5)return
    remote.movingUntil=this.time.now+200
    this.tweens.killTweensOf(remote.sprite)
    this.tweens.add({targets:remote.sprite,x,y,duration:115,onUpdate:()=>{
      remote.label.setPosition(remote.sprite.x,remote.sprite.y-NAME_TAG_GAP)
      this.positionBubble(remote.bubble,remote.sprite)
      setDepthIfChanged(remote.sprite,remote.sprite.y+10);setDepthIfChanged(remote.label,tagDepth(remote.sprite.y))
    }})
  }
  private positionBubble(bubble:Tag|Phaser.GameObjects.Image|undefined,sprite:Phaser.GameObjects.Image){
    if(bubble instanceof Tag)bubble.setPosition(sprite.x,sprite.y-BUBBLE_GAP)
    else bubble?.setPosition(sprite.x,sprite.y-BUBBLE_GAP-20)
  }
  private makeBubble(sprite:Phaser.GameObjects.Image,text:string){
    const reaction=reactionOptions.find(option=>option.emoji===text)
    if(reaction)return this.sprite(sprite.x,sprite.y-BUBBLE_GAP-20,`reaction-${reaction.id}`,900)
    return this.tag(sprite.x,sprite.y-BUBBLE_GAP,text.slice(0,32),TAG_FONT,140).setDepth(900)
  }
  showStaffBubble(text:string){
    if(!this.cashier)return
    this.cashierBubbleTimer?.remove(false)
    this.cashierBubble?.destroy()
    // Staff messages come from the server-verified chat role, not a visitor ID.
    const message=text.slice(0,160)
    this.cashierBubble=this.tag(this.cashier.x,this.cashier.y-26,message,TAG_FONT,200).setDepth(900)
    this.cashierBubbleTimer=this.time.delayedCall(Math.min(12000,Math.max(5000,message.length*60)),()=>{
      this.cashierBubble?.destroy()
      this.cashierBubble=undefined
      this.cashierBubbleTimer=undefined
    })
  }
  showBubble(id:string,text:string){
    if(id===this.selfId && this.self){
      this.selfBubble?.destroy()
      const sprite=this.self.sprite
      const bubble=this.makeBubble(sprite,text)
      this.selfBubble=bubble
      this.time.delayedCall(3500,()=>{if(this.selfBubble===bubble)this.selfBubble=undefined;bubble.destroy()})
      return
    }
    const target=this.remotes.get(id)
    if(!target)return
    target.bubble?.destroy()
    const bubble=this.makeBubble(target.sprite,text)
    target.bubble=bubble
    this.time.delayedCall(3500,()=>{if(target.bubble===bubble)target.bubble=undefined;bubble.destroy()})
  }
}
export function createGame(el:HTMLElement,opts:Options):StoreGame{
  // Render at a whole multiple of the world size close to the device's pixels, then let the
  // browser scale the canvas the last small step. Sprites stay crisp without blurry upscaling.
  const zoom=Math.max(1,Math.min(4,Math.round(opts.zoom??1)))
  const scene=new StoreScene({...opts,zoom})
  const game=new Phaser.Game({type:Phaser.AUTO,parent:el,width:W*zoom,height:H*zoom,backgroundColor:'#6e4a31',pixelArt:true,
    scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_HORIZONTALLY,width:W*zoom,height:H*zoom},scene:[scene],render:{antialias:false}})
  return {game,setDirection:(x,y)=>scene.setDirection(x,y),setPlayers:(players,id)=>{if(scene.sys?.isActive())scene.setPlayers(players,id)},movePlayer:(id,x,y)=>{if(scene.sys?.isActive())scene.movePlayer(id,x,y)},tossYarn:()=>scene.sys?.isActive()?scene.tossYarn():false,petCat:()=>scene.sys?.isActive()?scene.petCat():'busy',showBubble:(id,t)=>{if(scene.sys?.isActive())scene.showBubble(id,t)},showStaffBubble:(text)=>{if(scene.sys?.isActive())scene.showStaffBubble(text)},setBoard:(orders)=>{if(scene.sys?.isActive())scene.setBoard(orders)},setReducedMotion:value=>scene.setReducedMotion(value),setControlsEnabled:value=>scene.setControlsEnabled(value),setJukebox:state=>scene.setJukebox(state),setMenuItems:items=>scene.setMenuItems(items)}
}
