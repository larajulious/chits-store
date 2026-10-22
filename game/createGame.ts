import Phaser from 'phaser'
import { avatarOptions, type AvatarId } from '../shared/avatars'
import { reactionOptions } from '../shared/reactions'
import type {OrderStatus} from '../shared/order-status'
import {mascotFloorPoint,type CatMood} from '../shared/store-mascot'
import {createLocalMascot} from './localMascot'

export type Avatar = AvatarId
export type Player = { id:string;nickname:string;avatar:string;x:number;y:number }
export type BoardOrder = { id:number;number:string;name:string|null;status:OrderStatus }
export type StoreGame = { game:Phaser.Game; setDirection:(x:number,y:number)=>void;setPlayers:(players:Player[],selfId:string)=>void;movePlayer:(id:string,x:number,y:number)=>void;tossYarn:()=>boolean;petCat:()=> 'petted'|'too_far'|'busy';showBubble:(id:string,text:string)=>void;showStaffBubble:(text:string)=>void;setBoard:(orders:BoardOrder[])=>void;setReducedMotion:(value:boolean)=>void;setControlsEnabled:(value:boolean)=>void }
type Options = {nickname:string;avatar:Avatar;onMove:(x:number,y:number)=>void;onInteract:(kind:string)=>void;onCatHint:()=>void;onCatMeow:()=>void;catEnabled?:boolean;guideEnabled?:boolean;reducedMotion?:boolean;controlsEnabled?:boolean}
type Character = {sprite:Phaser.GameObjects.Image;avatar:string;phase:number}
type VisitorCharacter = Character & {label:Phaser.GameObjects.Text;movingUntil:number;bubble?:Phaser.GameObjects.Text|Phaser.GameObjects.Image}
function characterPhase(id:string){let hash=0;for(const char of id)hash=(hash*31+char.charCodeAt(0))>>>0;return hash%6000}
// Phaser queues a full display-list sort on every setDepth call, even if the value is unchanged.
function setDepthIfChanged(object:Phaser.GameObjects.Image|Phaser.GameObjects.Text,depth:number){if(object.depth!==depth)object.setDepth(depth)}
const W=360,H=580,CELL=20
const VISITOR_SCALE=1.15,STAFF_SCALE=1.25,NAME_LABEL_OFFSET=40
const tables=[new Phaser.Geom.Rectangle(48,328,87,60),new Phaser.Geom.Rectangle(228,365,86,58)]
const feedbackArea=new Phaser.Geom.Rectangle(282,472,44,40)
const obstructions=[...tables,feedbackArea]
const menuGuideStops=[{x:240,y:440},{x:260,y:500},{x:210,y:500},{x:120,y:500},{x:120,y:440},{x:120,y:500},{x:235,y:535}]
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

class StoreScene extends Phaser.Scene {
  private opts:Options
  private self?:VisitorCharacter
  private remotes=new Map<string,VisitorCharacter>()
  private staff:Character[]=[]
  private menuGuide?:VisitorCharacter
  private menuGuidePath:Phaser.Math.Vector2[]=[]
  private menuGuideStop=0
  private menuGuidePauseUntil=0
  private direction=new Phaser.Math.Vector2(0,0)
  private path:Phaser.Math.Vector2[]=[]
  private afterPath?:()=>void
  private keys?:Record<string,Phaser.Input.Keyboard.Key>
  private lastMove=0
  private lastX=180
  private lastY=510
  private selfId=''
  private selfBubble?:Phaser.GameObjects.Text|Phaser.GameObjects.Image
  private cashier?:Phaser.GameObjects.Image
  private cashierBubble?:Phaser.GameObjects.Text
  private cashierBubbleTimer?:Phaser.Time.TimerEvent
  private cookingEffects?:Phaser.GameObjects.Graphics
  private cookingFrame=-2
  private orderBoardText?:Phaser.GameObjects.Text
  private catSprite?:Phaser.GameObjects.Image
  private catLabel?:Phaser.GameObjects.Text
  private catBubble?:Phaser.GameObjects.Text
  private catBubbleTimer?:Phaser.Time.TimerEvent
  private lastMeowAt=-Infinity
  private yarnSprite?:Phaser.GameObjects.Image
  private mascot?:ReturnType<typeof createLocalMascot>
  private draggingYarn?:{pointerId:number;lastX:number;lastY:number;lastAt:number;previousX:number;previousY:number;previousAt:number}
  constructor(opts:Options){super('Store');this.opts=opts;if(opts.catEnabled!==false)this.mascot=createLocalMascot()}
  create(){
    this.cameras.main.setBackgroundColor('#c49c6b')
    const g=this.add.graphics()
    // Deliberate placeholder tile art. Replace with a Tiled map and real sprite sheets later.
    g.fillStyle(0xdab080).fillRect(0,0,W,H)
    for(let y=0;y<H;y+=20)for(let x=0;x<W;x+=20){g.lineStyle(1,((x/20+y/20)%2)?0xc79b6c:0xe8bb88,.5);g.strokeRect(x,y,20,20)}
    g.fillStyle(0xeed7b4).fillRect(0,0,W,250)
    g.fillStyle(0xb98159).fillRect(0,0,W,32)
    for(let i=0;i<12;i++){g.fillStyle(i%2?0x965f45:0xffe9c7);g.fillRect(i*30,28,30,30)}
    // Decorative kitchen on left
    g.fillStyle(0x84604b).fillRect(15,74,152,112);g.fillStyle(0xffe1b2).fillRect(22,80,138,100)
    g.fillStyle(0x965d41).fillRect(31,111,120,43)
    g.fillStyle(0x444143).fillRect(58,116,54,29)
    g.fillStyle(0x766a5e).fillRect(62,120,46,3)
    g.fillStyle(0xffcd81).fillRect(67,125,33,12)
    g.fillStyle(0x9a603f).fillRect(119,133,23,12)
    g.fillStyle(0xf0cd8e).fillRect(122,134,17,8)
    g.fillStyle(0x80a766).fillRect(125,135,4,3).fillRect(134,139,3,2)
    g.fillStyle(0xc7e1be).fillRect(116,103,23,23)
    // Order board on the right
    g.fillStyle(0x6e4935).fillRoundedRect(184,65,162,132,7)
    g.fillStyle(0x303d38).fillRoundedRect(192,72,146,118,3)
    this.add.text(265,82,'LIVE ORDERS',{fontFamily:'monospace',fontSize:'13px',color:'#ffe1a7',fontStyle:'bold'}).setOrigin(.5)
    this.orderBoardText=this.add.text(201,98,'',{fontFamily:'monospace',fontSize:'9px',color:'#dfecd0',lineSpacing:0})
    this.setBoard([])
    // Counter across shop
    g.fillStyle(0x674730).fillRect(34,208,292,46);g.fillStyle(0xa8724e).fillRect(37,199,285,44)
    g.fillStyle(0xedc18a).fillRect(47,202,262,8)
    this.add.text(181,231,'ORDER COUNTER',{fontFamily:'monospace',fontSize:'13px',fontStyle:'bold',color:'#fff0ce'}).setOrigin(.5)
    // Waiting tables and mats
    for(const t of tables){g.fillStyle(0x875943).fillRoundedRect(t.x,t.y,t.width,t.height,8);g.fillStyle(0xf4d3a3).fillRoundedRect(t.x+8,t.y+8,t.width-16,t.height-16,7)}
    g.fillStyle(0xad775b).fillRect(137,552,85,28);g.fillStyle(0xefd5a4).fillRoundedRect(145,548,68,28,7)
    // A pixel suggestion box visitors can walk over to and open.
    g.fillStyle(0x674731).fillRect(282,472,44,40)
    g.fillStyle(0xc4935a).fillRect(285,475,38,34)
    g.fillStyle(0xffe6ad).fillRect(289,486,30,18)
    g.fillStyle(0x493425).fillRect(290,479,28,4)
    this.add.text(304,462,'FEEDBACK',{fontFamily:'monospace',fontSize:'8px',color:'#5f4637',fontStyle:'bold'}).setOrigin(.5)
    this.add.text(304,495,'WRITE',{fontFamily:'monospace',fontSize:'8px',color:'#674731'}).setOrigin(.5)
    this.add.text(180,562,'ENTRANCE',{fontFamily:'monospace',fontSize:'10px',color:'#5f4637'}).setOrigin(.5)
    this.add.text(180,13,'✦ CHITS STORE ✦',{fontSize:'15px',fontFamily:'monospace',color:'#fff3ce',fontStyle:'bold'}).setOrigin(.5)
    this.add.text(92,65,'KITCHEN',{fontFamily:'monospace',fontSize:'11px',color:'#5c392a'}).setOrigin(.5)
    // Keep the bakery background in the scene until scene teardown.
    // Original placeholders drawn as simple pixel shapes, not final copyrighted game art.
    for(const [name,body,detail] of [
      ...avatarOptions.map(avatar=>[avatar.id,avatar.body,avatar.detail] as const),
      ['cashier',0xf5d7aa,0x5a9477],['chef',0xffe6aa,0xa47758],
      ...(this.opts.guideEnabled===false?[]:[['menu-guide',0xf3cf82,0x8c6242] as const]),
    ] as const){
      const art=this.make.graphics({x:0,y:0})
      const mascotBody=name!=='cashier'&&name!=='chef'
      // Visitors and the walking menu guide share one small full-body silhouette.
      // Draw it behind each food-shaped head so every avatar keeps its own face.
      if(mascotBody){
        art.fillStyle(0x674731).fillRect(10,45,6,3).fillRect(20,45,6,3)
        art.fillStyle(0x56704e).fillRect(11,40,5,6).fillRect(20,40,5,6)
        art.fillStyle(body).fillRect(5,30,5,12).fillRect(25,30,5,12)
        art.fillStyle(0x7d9b67).fillRoundedRect(9,26,17,18,3)
        art.fillStyle(0x608256).fillRect(6,32,4,7).fillRect(25,32,4,7)
        art.fillStyle(0xe9d9ae).fillRect(13,34,9,10)
      }
      if(name==='mochi'){
        art.fillStyle(detail).fillEllipse(17,23,30,18)
        art.fillStyle(body).fillEllipse(17,16,30,26).fillEllipse(17,22,30,14)
        art.fillStyle(0xfffaf0).fillRect(7,8,4,2).fillRect(24,7,3,2).fillRect(5,22,3,2).fillRect(25,24,4,2)
      }else if(name==='maja'){
        art.fillStyle(detail).fillRoundedRect(2,7,30,25,3);art.fillStyle(body).fillRoundedRect(2,3,30,25,3)
        art.fillStyle(0xfff1a7).fillRect(6,5,4,3).fillRect(15,6,4,3).fillRect(24,5,4,3).fillRect(5,24,5,3).fillRect(24,24,5,3)
        art.fillStyle(detail).fillRect(11,2,3,2).fillRect(22,3,3,2)
      }else if(name==='boba'){
        art.fillStyle(detail).fillPoints([{x:3,y:8},{x:31,y:8},{x:27,y:32},{x:7,y:32}],true)
        art.fillStyle(body).fillPoints([{x:5,y:9},{x:29,y:9},{x:26,y:29},{x:8,y:29}],true)
        art.lineStyle(3,0x735543).lineBetween(23,2,21,9)
        art.fillStyle(0xeed6b1).fillRoundedRect(2,6,30,4,2)
        art.fillStyle(detail).fillCircle(11,26,2).fillCircle(17,28,2).fillCircle(23,26,2)
      }else if(name==='cupcake'){
        art.fillStyle(detail).fillPoints([{x:4,y:21},{x:30,y:21},{x:26,y:32},{x:8,y:32}],true)
        art.lineStyle(2,0xf5c58e).lineBetween(11,25,12,31).lineBetween(22,25,21,31).lineBetween(17,25,17,31)
        art.fillStyle(body).fillRoundedRect(3,10,28,14,5).fillCircle(10,10,6).fillCircle(23,10,6).fillCircle(17,6,5)
        art.fillStyle(0xffe9de).fillRect(9,5,3,2).fillRect(23,6,3,2).fillRect(15,2,3,2)
      }else if(name==='palitaw'){
        art.fillStyle(detail).fillEllipse(17,19,30,22);art.fillStyle(body).fillEllipse(17,16,30,22)
        art.fillStyle(0xba9664)
        for(const [x,y] of [[6,9],[13,6],[24,7],[7,23],[24,22]])art.fillRect(x!,y!,3,2)
        art.fillStyle(0xfffdf5).fillRect(2,14,4,2).fillRect(28,19,4,2).fillRect(15,26,4,2)
      }else if(name==='biko'){
        art.fillStyle(detail).fillRoundedRect(2,6,30,25,3);art.fillStyle(body).fillRoundedRect(2,3,30,24,3)
        art.fillStyle(detail).fillRect(5,6,4,3).fillRect(14,4,3,3).fillRect(24,6,4,3).fillRect(6,22,4,3).fillRect(24,22,4,3)
      }else if(name==='puto'){
        art.fillStyle(0xe2ccaa).fillRoundedRect(6,12,22,19,3)
        art.fillStyle(body).fillRoundedRect(3,9,28,19,6).fillEllipse(17,11,28,18)
        art.fillStyle(detail).fillRect(10,4,14,4)
      }else if(name==='kutsinta'){
        art.fillStyle(detail).fillEllipse(17,19,30,24);art.fillStyle(body).fillEllipse(17,15,30,22)
        art.fillStyle(0xdd9550).fillEllipse(17,8,16,6)
        art.fillStyle(0xfff4da).fillRect(7,24,3,2).fillRect(13,26,3,2).fillRect(19,25,3,2).fillRect(25,23,3,2)
      }else if(name==='suman'){
        art.fillStyle(detail).fillRoundedRect(6,2,22,30,4);art.fillStyle(body).fillRect(10,2,12,30)
        art.fillStyle(0xe9d6a5).fillRect(6,7,22,3).fillRect(6,24,22,3)
      }else if(name==='sapin-sapin'){
        art.fillStyle(detail).fillRoundedRect(2,5,30,25,3)
        art.fillStyle(0xfff2d9).fillRect(2,12,30,9);art.fillStyle(body).fillRect(2,5,30,8)
        art.fillStyle(0x8d65a7).fillRect(6,6,4,2).fillRect(23,8,5,2)
      }else if(name==='bibingka'){
        art.fillStyle(detail).fillRoundedRect(1,6,32,25,3);art.fillStyle(body).fillEllipse(17,17,30,26)
        art.fillStyle(0xfff1b9).fillRect(7,6,9,3).fillRect(23,9,5,3)
        art.fillStyle(0xbd8242).fillRect(6,23,3,2).fillRect(23,25,4,2)
      }else if(name==='menu-guide'){
        art.fillStyle(detail).fillRoundedRect(2,7,30,25,3)
        art.fillStyle(body).fillEllipse(17,17,28,26)
        art.fillStyle(0xfdf1d0).fillRect(5,2,24,5).fillRect(9,0,16,3)
        art.fillStyle(0x7d9b67).fillRect(7,26,20,5)
        art.fillStyle(0xfff4d8).fillRect(14,26,6,4)
      }else if(name==='pichi-pichi'){
        art.fillStyle(body).fillCircle(10,13,9).fillCircle(24,13,9).fillCircle(17,24,9)
        art.fillStyle(detail).fillRect(4,9,3,3).fillRect(15,5,3,3).fillRect(27,8,4,3).fillRect(6,20,3,3).fillRect(13,28,3,3).fillRect(25,24,3,3)
      }else{
        art.fillStyle(detail).fillRect(3,12,26,19);art.fillStyle(body).fillRoundedRect(2,1,28,26,7)
      }
      art.fillStyle(0xe18e8e).fillRect(5,18,5,3).fillRect(24,18,5,3)
      if(!['cashier','chef'].includes(name))art.fillStyle(0x815145).fillRect(15,21,4,2)
      if(name==='chef'){
        art.fillStyle(0xfff8e7).fillRect(5,5,24,6).fillRect(8,1,18,7).fillRect(12,0,10,3)
        art.fillStyle(0xd8c8b2).fillRect(6,10,22,2)
        art.fillStyle(0xfff8e7).fillRect(7,25,20,8)
        art.fillStyle(0xd8c8b2).fillRect(15,26,4,2)
        art.fillStyle(0x815145).fillRect(15,21,4,2)
      }
      if(name==='cashier'){art.fillStyle(0x4d7857).fillRect(6,26,22,5)}
      art.fillStyle(0x33251f).fillRect(9,14,3,1).fillRect(22,14,3,1)
      art.generateTexture(`${name}-blink`,34,mascotBody?48:34)
      art.fillStyle(0x33251f).fillRect(9,12,3,4).fillRect(22,12,3,4)
      art.generateTexture(name,34,mascotBody?48:34);art.destroy()
    }
    for(const reaction of reactionOptions){
      const art=this.make.graphics({x:0,y:0})
      art.fillStyle(0x674731).fillRect(0,2,40,36).fillRect(2,0,36,40)
      art.fillStyle(0xfff3da).fillRect(2,2,36,36)
      for(const [x,y,width,height,color] of reaction.pixels)art.fillStyle(color).fillRect(4+x*2,4+y*2,width*2,height*2)
      art.generateTexture(`reaction-${reaction.id}`,40,40);art.destroy()
    }
    if(this.mascot)this.createMascotTextures()
    const chef=this.add.image(89,164,'chef').setDepth(180).setScale(STAFF_SCALE)
    this.cookingEffects=this.add.graphics().setDepth(181)
    this.updateChefCooking()
    const cashier=this.add.image(178,190,'cashier').setDepth(191).setScale(STAFF_SCALE)
    this.cashier=cashier
    this.staff=[{sprite:chef,avatar:'chef',phase:characterPhase('chef')},{sprite:cashier,avatar:'cashier',phase:characterPhase('cashier')}]
    this.add.text(92,190,'CHEF',{fontFamily:'monospace',fontSize:'10px',color:'#674530'}).setOrigin(.5)
    this.add.text(177,160,'STAFF',{fontFamily:'monospace',fontSize:'10px',color:'#674530'}).setOrigin(.5)
    // Enter beside the visitor so the larger sprites and name tags stay separate.
    if(this.opts.guideEnabled!==false){
      const guideSprite=this.add.image(this.opts.reducedMotion?180:235,this.opts.reducedMotion?440:535,'menu-guide').setDepth(550).setScale(VISITOR_SCALE)
      const guideLabel=this.add.text(180,guideSprite.y-NAME_LABEL_OFFSET,'MENU • TAP',{fontFamily:'monospace',fontSize:'9px',fontStyle:'bold',color:'#38291d',backgroundColor:'#fff4d5',padding:{x:4,y:2}}).setOrigin(.5).setDepth(551)
      this.menuGuide={sprite:guideSprite,label:guideLabel,avatar:'menu-guide',phase:characterPhase('menu-guide'),movingUntil:0}
      this.menuGuidePauseUntil=this.time.now+1100
    }
    const sprite=this.add.image(180,510,this.opts.avatar).setDepth(520).setScale(VISITOR_SCALE)
    const label=this.add.text(180,510-NAME_LABEL_OFFSET,this.opts.nickname,{fontFamily:'monospace',fontSize:'11px',fontStyle:'bold',color:'#38291d',backgroundColor:'#fff7e1',padding:{x:4,y:2}}).setOrigin(.5).setDepth(521)
    this.self={sprite,label,avatar:this.opts.avatar,phase:characterPhase(this.opts.nickname),movingUntil:0}
    if(this.mascot){
      this.catSprite=this.add.image(100,290,'cat-sit').setDepth(300)
      this.catLabel=this.add.text(100,258,'MIMING',{fontFamily:'monospace',fontSize:'9px',fontStyle:'bold',color:'#513826',backgroundColor:'#fff1d2',padding:{x:3,y:1}}).setOrigin(.5).setDepth(301)
      this.yarnSprite=this.add.image(175,440,'yarn-ball').setDepth(450)
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
      if(this.menuGuide&&Math.abs(x-this.menuGuide.sprite.x)<42&&Math.abs(y-this.menuGuide.sprite.y)<45){
        this.menuGuidePath=[];this.menuGuidePauseUntil=this.time.now+3500;this.menuGuide.sprite.setTint(0xffecc2);this.opts.onInteract('menu');return
      }
      if(this.yarnSprite&&Math.hypot(x-this.yarnSprite.x,y-this.yarnSprite.y)<24&&this.mascot?.pickup()){
        const now=this.time.now
        this.draggingYarn={pointerId:pointer.id,lastX:x,lastY:y,lastAt:now,previousX:x,previousY:y,previousAt:now}
        return
      }
      if(this.catSprite&&Math.abs(x-this.catSprite.x)<27&&Math.abs(y-this.catSprite.y)<24){const result=this.petCat();if(result!=='petted')this.meow();if(result==='too_far')this.opts.onCatHint();return}
      if(y<198&&x>185){this.walkTo(272,277,()=>this.opts.onInteract('board'));return}
      if(y<195&&x<175){this.walkTo(93,273,()=>this.opts.onInteract('chef'));return}
      if(y<256&&x>32){this.walkTo(177,273,()=>this.opts.onInteract('cashier'));return}
      if(x>=274&&x<=334&&y>=450&&y<=520){this.walkTo(260,500,()=>this.opts.onInteract('feedback'));return}
      if(tables.some(r=>r.contains(x,y))){this.walkTo(x<180?145:220,y,()=>this.opts.onInteract('seat'));return}
      const p=closestPoint(x,y);this.walkTo(p.x,p.y)
    })
    this.input.on('pointermove',(pointer:Phaser.Input.Pointer)=>this.dragYarn(pointer))
    this.input.on('pointerup',(pointer:Phaser.Input.Pointer)=>this.releaseYarn(pointer))
    this.input.on('pointerupoutside',(pointer:Phaser.Input.Pointer)=>this.releaseYarn(pointer))
  }
  setBoard(orders:BoardOrder[]){
    const label=(order:BoardOrder|undefined)=>{
      if(!order)return '—'
      const characters=Array.from(order.name||'')
      const name=characters.length>12?`${characters.slice(0,11).join('')}…`:characters.join('')
      return `${order.number}${name?` · ${name}`:''}`
    }
    const latest=(status:BoardOrder['status'])=>label(orders.find(o=>o.status===status))
    // The public feed is newest first; keep this small in-game board to five deliveries.
    const deliveries=orders.filter(o=>o.status==='Served').slice(0,5).map(label)
    if(this.orderBoardText){
      this.orderBoardText.setText(`PREPARING: ${latest('Preparing')}\nREADY: ${latest('Ready')}\nOUT FOR DELIVERY:\n${deliveries.length?deliveries.join('\n'):'—'}`)
      // Keep number and abbreviated name lines inside the chalkboard.
      this.orderBoardText.setScale(Math.min(1,128/this.orderBoardText.width),1)
    }
  }
  private createMascotTextures(){
    const makeCat=(name:string,pose:'stand'|'sit'|'lie'|'stretch',eyes:'open'|'closed'='open',tail=0)=>{
      const art=this.make.graphics({x:0,y:0})
      const fur=0xd58b51,light=0xf7ca88,dark=0x78513f,shadow=0x76513f
      art.fillStyle(shadow,.25).fillEllipse(23,32,36,5)
      if(pose==='lie'){
        art.fillStyle(fur).fillRoundedRect(7,20,32,11,4).fillRect(35,22,7,6)
        art.fillStyle(light).fillRect(14,25,18,4)
      }else if(pose==='stretch'){
        art.fillStyle(fur).fillRoundedRect(14,19,24,10,3).fillRect(7,27,8,4).fillRect(35,27,8,4)
        art.fillStyle(light).fillRect(22,22,10,4)
      }else{
        art.fillStyle(fur).fillRoundedRect(16,17,24,15,5)
        art.fillStyle(light).fillRect(22,23,12,7)
        if(pose==='stand')art.fillStyle(fur).fillRect(17,29,5,4).fillRect(34,29,5,4)
      }
      art.fillStyle(fur).fillRect(37,22-tail*3,5,7).fillRect(40,17-tail*5,4,8)
      art.fillStyle(dark).fillRect(39,16-tail*5,5,2)
      const headY=pose==='lie'?17:pose==='stretch'?19:10
      art.fillStyle(fur).fillRoundedRect(8,headY,23,19,5)
      art.fillStyle(fur).fillTriangle(9,headY+3,11,headY-7,17,headY+1).fillTriangle(23,headY+1,29,headY-7,30,headY+4)
      art.fillStyle(0xe9aa99).fillTriangle(11,headY,12,headY-4,15,headY).fillTriangle(25,headY,28,headY-4,29,headY)
      art.fillStyle(light).fillRect(12,headY+12,15,6)
      art.fillStyle(dark)
      if(eyes==='closed')art.fillRect(13,headY+9,4,1).fillRect(24,headY+9,4,1)
      else art.fillRect(14,headY+7,2,3).fillRect(25,headY+7,2,3)
      art.fillStyle(0x9e5f62).fillRect(19,headY+12,3,2)
      art.generateTexture(name,48,36);art.destroy()
    }
    makeCat('cat-idle','stand');makeCat('cat-walk','stand','open',1);makeCat('cat-sit','sit');makeCat('cat-rest','lie');makeCat('cat-sleep','lie','closed');makeCat('cat-stretch','stretch');makeCat('cat-notice','sit','open',1);makeCat('cat-play','stand','open',1)
    const ball=this.make.graphics({x:0,y:0})
    ball.fillStyle(0x76513f,.3).fillEllipse(11,18,19,4)
    ball.fillStyle(0x634471).fillRect(6,4,11,11).fillRect(4,6,15,7)
    ball.fillStyle(0xb68abc).fillRect(6,4,5,3).fillRect(12,8,5,3).fillRect(7,12,6,2)
    ball.fillStyle(0xf2c693).fillRect(7,7,3,2).fillRect(14,4,2,3)
    ball.lineStyle(1,0x634471).lineBetween(13,15,19,17)
    ball.generateTexture('yarn-ball',23,21);ball.destroy()
  }
  tossYarn(){return this.mascot?.toss(this.time.now)??false}
  petCat(){const result=this.mascot?.pet({x:this.self?.sprite.x??180,y:this.self?.sprite.y??510},this.time.now)??'busy';if(result==='petted')this.meow();return result}
  private meow(){
    const cat=this.catSprite
    if(!cat||this.time.now-this.lastMeowAt<1200)return
    this.lastMeowAt=this.time.now
    this.catBubbleTimer?.remove(false)
    this.catBubble?.destroy()
    const bubble=this.add.text(cat.x,cat.y-49,'meow meow',{fontFamily:'monospace',fontSize:'11px',color:'#513826',backgroundColor:'#fff6de',padding:{x:6,y:4}}).setOrigin(.5,1).setDepth(900)
    this.catBubble=bubble
    this.catBubbleTimer=this.time.delayedCall(2200,()=>{if(this.catBubble===bubble)this.catBubble=undefined;bubble.destroy();this.catBubbleTimer=undefined})
    this.opts.onCatMeow()
  }
  private updateMascot(delta:number){
    if(!this.mascot)return
    this.mascot.tick(this.time.now,delta)
    const snapshot=this.mascot.snapshot(this.time.now),cat=this.catSprite,ball=this.yarnSprite,label=this.catLabel
    if(!cat||!ball||!label)return
    cat.setPosition(snapshot.cat.x,snapshot.cat.y)
    this.catBubble?.setPosition(cat.x,cat.y-49)
    ball.setPosition(snapshot.yarn.x,snapshot.yarn.y)
    const mood:CatMood=snapshot.cat.mood
    const texture=mood==='walking'||mood==='approaching_yarn'||mood==='returning_to_idle'?(Math.floor(this.time.now/180)%2?'cat-walk':'cat-idle'):
      mood==='sleeping'?'cat-sleep':mood==='resting'?'cat-rest':mood==='stretching'?'cat-stretch':mood==='noticing_yarn'?'cat-notice':mood==='playing_with_yarn'?'cat-play':'cat-sit'
    if(cat.texture.key!==texture)cat.setTexture(texture)
    cat.setFlipX(snapshot.cat.facing<0)
    const playful=mood==='playing_with_yarn'&&!this.opts.reducedMotion
    cat.setAngle(playful?Math.sin(this.time.now/140)*6:0).setScale(playful?1.07:snapshot.cat.purring&&!this.opts.reducedMotion?1+Math.sin(this.time.now/180)*.025:1)
    setDepthIfChanged(cat,cat.y+12);label.setPosition(cat.x,cat.y-29);setDepthIfChanged(label,cat.y+13)
    const caption=snapshot.cat.purring?'MIMING ♥':mood==='sleeping'?'MIMING zZ':mood==='noticing_yarn'?'MIMING !':'MIMING'
    if(label.text!==caption)label.setText(caption)
    setDepthIfChanged(ball,ball.y+12);ball.setAngle(this.opts.reducedMotion?0:snapshot.yarn.moving?this.time.now/12:0)
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
  walkTo(x:number,y:number,callback?:()=>void){if(!this.self||this.inputBlocked())return;this.path=pathFind(new Phaser.Math.Vector2(this.self.sprite.x,this.self.sprite.y),new Phaser.Math.Vector2(x,y));this.afterPath=callback}
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
  private animateCharacter(character:Character,moving:boolean,baseScale=VISITOR_SCALE){
    const {sprite,avatar,phase}=character
    if(this.opts.reducedMotion){
      sprite.setScale(baseScale).setAngle(0).setOrigin(.5)
      if(sprite.texture.key!==avatar)sprite.setTexture(avatar)
      return
    }
    const time=this.time.now+phase
    const breath=Math.sin(time/800),step=Math.sin(time/95)
    const squash=moving?step*.045:breath*.02
    // Animate only the artwork: x/y remain the collision and network coordinates.
    sprite.setScale(baseScale*(1+squash),baseScale*(1-squash))
      .setAngle(moving?step*3:0)
      .setOrigin(.5,.5+(moving?Math.abs(step)*1.5:Math.max(0,breath)*.4)/34)
    const texture=time%(3800+phase%1800)<120?`${avatar}-blink`:avatar
    if(sprite.texture.key!==texture)sprite.setTexture(texture)
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
    guide.label.setPosition(guide.sprite.x,guide.sprite.y-NAME_LABEL_OFFSET)
    setDepthIfChanged(guide.sprite,guide.sprite.y+10);setDepthIfChanged(guide.label,guide.sprite.y+11)
  }
  private updateChefCooking(){
    const frame=this.opts.reducedMotion?-1:Math.floor(this.time.now/140)%12
    if(frame===this.cookingFrame||!this.cookingEffects)return
    this.cookingFrame=frame
    const art=this.cookingEffects
    art.clear()
    const stir=frame<0?0:Math.round(Math.sin(frame*Math.PI/6)*4)
    const panY=132+(frame>=0&&frame%4===0?-1:0)
    // A dark skillet, bubbling kakanin and a handle make the kitchen task readable at game scale.
    art.fillStyle(0x382d28).fillRect(74,panY,36,4).fillRect(78,panY+4,29,9).fillRect(109,panY+3,15,4)
    art.fillStyle(0xb46a3d).fillRect(80,panY+4,25,5)
    art.fillStyle(0xf6c46d).fillRect(82+Math.max(0,stir),panY+5,5,3).fillRect(96-Math.max(0,stir),panY+6,4,2)
    art.fillStyle(0x79a365).fillRect(89,panY+6,4,2)
    if(frame>=0){
      for(let i=0;i<3;i++){
        const rise=(frame*2+i*5)%15
        art.fillStyle(0x9c826c,.7).fillRect(80+i*9,126-rise,2,4)
        art.fillStyle(0xb49b80,.55).fillRect(83+i*9,122-rise,2,3)
      }
    }else{
      art.fillStyle(0x9c826c,.6).fillRect(82,118,2,4).fillRect(101,115,2,4)
    }
    // The chef's hand stirs across the pan while the pan and steam move independently.
    art.lineStyle(5,0xf4c88f).lineBetween(101,161,108+stir,148)
    art.fillStyle(0xf4c88f).fillRect(105+stir,145,5,5)
    art.lineStyle(3,0x765039).lineBetween(107+stir,147,90+stir,137)
    art.fillStyle(0x765039).fillRect(87+stir,134,7,3)
  }
  override update(_:number,delta:number){
    this.updateMascot(delta)
    for(const character of this.staff)this.animateCharacter(character,false,STAFF_SCALE)
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
    this.self.label.setPosition(sprite.x,sprite.y-NAME_LABEL_OFFSET)
    setDepthIfChanged(sprite,sprite.y+10);setDepthIfChanged(this.self.label,sprite.y+11)
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
        remote={sprite:this.add.image(p.x,p.y,p.avatar).setDepth(p.y+10).setScale(VISITOR_SCALE),label:this.add.text(p.x,p.y-NAME_LABEL_OFFSET,p.nickname,{fontFamily:'monospace',fontSize:'10px',color:'#3c2d1e',backgroundColor:'#fff5df',padding:{x:3,y:2}}).setOrigin(.5).setDepth(p.y+11),avatar:p.avatar,phase:characterPhase(p.id),movingUntil:0}
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
      remote.label.setPosition(remote.sprite.x,remote.sprite.y-NAME_LABEL_OFFSET)
      setDepthIfChanged(remote.sprite,remote.sprite.y+10);setDepthIfChanged(remote.label,remote.sprite.y+11)
    }})
  }
  private makeBubble(sprite:Phaser.GameObjects.Image,text:string){
    const reaction=reactionOptions.find(option=>option.emoji===text)
    if(reaction)return this.add.image(sprite.x,sprite.y-75,`reaction-${reaction.id}`).setDepth(900)
    return this.add.text(sprite.x,sprite.y-64,text.slice(0,32),{fontFamily:'monospace',fontSize:'10px',color:'#3c281e',backgroundColor:'#fff6de',padding:{x:6,y:4},wordWrap:{width:140}}).setOrigin(.5).setDepth(900)
  }
  showStaffBubble(text:string){
    if(!this.cashier)return
    this.cashierBubbleTimer?.remove(false)
    this.cashierBubble?.destroy()
    // Staff messages come from the server-verified chat role, not a visitor ID.
    const message=text.slice(0,160)
    this.cashierBubble=this.add.text(this.cashier.x,this.cashier.y-37,message,{
      fontFamily:'monospace',fontSize:'10px',color:'#3c281e',backgroundColor:'#fff6de',
      padding:{x:6,y:4},wordWrap:{width:200,useAdvancedWrap:true},
    }).setOrigin(.5,1).setDepth(900)
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
  const scene=new StoreScene(opts)
  const game=new Phaser.Game({type:Phaser.AUTO,parent:el,width:W,height:H,backgroundColor:'#d0a377',pixelArt:true,
    scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:W,height:H},scene:[scene],render:{antialias:false}})
  return {game,setDirection:(x,y)=>scene.setDirection(x,y),setPlayers:(players,id)=>{if(scene.sys?.isActive())scene.setPlayers(players,id)},movePlayer:(id,x,y)=>{if(scene.sys?.isActive())scene.movePlayer(id,x,y)},tossYarn:()=>scene.sys?.isActive()?scene.tossYarn():false,petCat:()=>scene.sys?.isActive()?scene.petCat():'busy',showBubble:(id,t)=>{if(scene.sys?.isActive())scene.showBubble(id,t)},showStaffBubble:(text)=>{if(scene.sys?.isActive())scene.showStaffBubble(text)},setBoard:(orders)=>{if(scene.sys?.isActive())scene.setBoard(orders)},setReducedMotion:value=>scene.setReducedMotion(value),setControlsEnabled:value=>scene.setControlsEnabled(value)}
}
