import Phaser from 'phaser'
import { avatarOptions, type AvatarId } from '../shared/avatars'

export type Avatar = AvatarId
export type Player = { id:string;nickname:string;avatar:string;x:number;y:number }
export type BoardOrder = { id:number;number:string;status:'Preparing'|'Ready'|'Served' }
export type StoreGame = { game:Phaser.Game; setDirection:(x:number,y:number)=>void;setPlayers:(players:Player[],selfId:string)=>void;showBubble:(id:string,text:string)=>void;setBoard:(orders:BoardOrder[])=>void }
type Options = {nickname:string;avatar:Avatar;onMove:(x:number,y:number)=>void;onInteract:(kind:string)=>void}
const W=360,H=580,CELL=20
const obstructions=[new Phaser.Geom.Rectangle(48,328,87,60),new Phaser.Geom.Rectangle(228,365,86,58)]
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
  private self?:{sprite:Phaser.GameObjects.Image,label:Phaser.GameObjects.Text}
  private remotes=new Map<string,{sprite:Phaser.GameObjects.Image,label:Phaser.GameObjects.Text,bubble?:Phaser.GameObjects.Text}>()
  private direction=new Phaser.Math.Vector2(0,0)
  private path:Phaser.Math.Vector2[]=[]
  private afterPath?:()=>void
  private keys?:Record<string,Phaser.Input.Keyboard.Key>
  private lastMove=0
  private lastX=180
  private lastY=510
  private selfId=''
  private selfBubble?:Phaser.GameObjects.Text
  private orderBoardText?:Phaser.GameObjects.Text
  constructor(opts:Options){super('Store');this.opts=opts}
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
    g.fillStyle(0x965d41).fillRect(31,111,120,43);g.fillStyle(0x444143).fillRect(58,116,42,29)
    g.fillStyle(0xffcd81).fillRect(60,121,38,8)
    g.fillStyle(0xc7e1be).fillRect(116,103,23,23)
    // Order board on the right
    g.fillStyle(0x6e4935).fillRoundedRect(184,71,162,121,7)
    g.fillStyle(0x303d38).fillRoundedRect(192,78,146,106,3)
    this.add.text(265,89,'LIVE ORDERS',{fontFamily:'monospace',fontSize:'13px',color:'#ffe1a7',fontStyle:'bold'}).setOrigin(.5)
    this.orderBoardText=this.add.text(201,112,'PREP: —\nREADY: —\nSERVED: —',{fontFamily:'monospace',fontSize:'11px',color:'#dfecd0',lineSpacing:10})
    // Counter across shop
    g.fillStyle(0x674730).fillRect(34,208,292,46);g.fillStyle(0xa8724e).fillRect(37,199,285,44)
    g.fillStyle(0xedc18a).fillRect(47,202,262,8)
    this.add.text(181,231,'ORDER COUNTER',{fontFamily:'monospace',fontSize:'13px',fontStyle:'bold',color:'#fff0ce'}).setOrigin(.5)
    // Waiting tables and mats
    for(const t of obstructions){g.fillStyle(0x875943).fillRoundedRect(t.x,t.y,t.width,t.height,8);g.fillStyle(0xf4d3a3).fillRoundedRect(t.x+8,t.y+8,t.width-16,t.height-16,7)}
    g.fillStyle(0xad775b).fillRect(137,552,85,28);g.fillStyle(0xefd5a4).fillRoundedRect(145,548,68,28,7)
    this.add.text(180,562,'ENTRANCE',{fontFamily:'monospace',fontSize:'10px',color:'#5f4637'}).setOrigin(.5)
    this.add.text(180,13,'✦ CHITS STORE ✦',{fontSize:'15px',fontFamily:'monospace',color:'#fff3ce',fontStyle:'bold'}).setOrigin(.5)
    this.add.text(92,65,'KITCHEN',{fontFamily:'monospace',fontSize:'11px',color:'#5c392a'}).setOrigin(.5)
    // Keep the bakery background in the scene until scene teardown.
    // Original placeholders drawn as simple pixel shapes, not final copyrighted game art.
    for(const [name,body,detail] of [
      ...avatarOptions.map(avatar=>[avatar.id,avatar.body,avatar.detail] as const),
      ['cashier',0xf5d7aa,0x5a9477],['chef',0xffe6aa,0xa47758],
    ] as const){
      const art=this.make.graphics({x:0,y:0})
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
      }else if(name==='pichi-pichi'){
        art.fillStyle(body).fillCircle(10,13,9).fillCircle(24,13,9).fillCircle(17,24,9)
        art.fillStyle(detail).fillRect(4,9,3,3).fillRect(15,5,3,3).fillRect(27,8,4,3).fillRect(6,20,3,3).fillRect(13,28,3,3).fillRect(25,24,3,3)
      }else{
        art.fillStyle(detail).fillRect(3,12,26,19);art.fillStyle(body).fillRoundedRect(2,1,28,26,7)
      }
      art.fillStyle(0x33251f).fillRect(9,12,3,4).fillRect(22,12,3,4)
      art.fillStyle(0xe18e8e).fillRect(5,18,5,3).fillRect(24,18,5,3)
      if(!['cashier','chef'].includes(name))art.fillStyle(0x815145).fillRect(15,21,4,2)
      if(name==='chef'){art.fillStyle(0xfff8e7).fillRect(3,0,28,7);art.fillRect(8,-5,17,6)}
      if(name==='cashier'){art.fillStyle(0x4d7857).fillRect(6,26,22,5)}
      art.generateTexture(name,34,34);art.destroy()
    }
    const chef=this.add.image(89,164,'chef').setDepth(180).setScale(1.15)
    const cashier=this.add.image(178,190,'cashier').setDepth(191).setScale(1.15)
    this.tweens.add({targets:chef,y:161,duration:500,yoyo:true,repeat:-1,ease:'Sine.easeInOut'})
    this.tweens.add({targets:cashier,scaleY:1.22,duration:1100,yoyo:true,repeat:-1})
    this.add.text(92,190,'CHEF',{fontFamily:'monospace',fontSize:'10px',color:'#674530'}).setOrigin(.5)
    this.add.text(177,165,'CASHIER',{fontFamily:'monospace',fontSize:'10px',color:'#674530'}).setOrigin(.5)
    const sprite=this.add.image(180,510,this.opts.avatar).setDepth(520)
    const label=this.add.text(180,490,this.opts.nickname,{fontFamily:'monospace',fontSize:'11px',fontStyle:'bold',color:'#38291d',backgroundColor:'#fff7e1',padding:{x:4,y:2}}).setOrigin(.5).setDepth(521)
    this.self={sprite,label}
    if(this.input.keyboard)this.keys=this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string,Phaser.Input.Keyboard.Key>
    this.input.on('pointerdown',(pointer:Phaser.Input.Pointer)=>{
      const x=pointer.worldX,y=pointer.worldY
      if(y<198&&x>185){this.walkTo(272,277,()=>this.opts.onInteract('board'));return}
      if(y<195&&x<175){this.walkTo(93,273,()=>this.opts.onInteract('chef'));return}
      if(y<256&&x>32){this.walkTo(177,273,()=>this.opts.onInteract('cashier'));return}
      if(obstructions.some(r=>r.contains(x,y))){this.walkTo(x<180?145:220,y,()=>this.opts.onInteract('seat'));return}
      const p=closestPoint(x,y);this.walkTo(p.x,p.y)
    })
  }
  setBoard(orders:BoardOrder[]){
    const latest=(status:BoardOrder['status'])=>orders.find(o=>o.status===status)?.number||'—'
    this.orderBoardText?.setText(`PREP: ${latest('Preparing')}\nREADY: ${latest('Ready')}\nSERVED: ${latest('Served')}`)
  }
  walkTo(x:number,y:number,callback?:()=>void){if(!this.self)return;this.path=pathFind(new Phaser.Math.Vector2(this.self.sprite.x,this.self.sprite.y),new Phaser.Math.Vector2(x,y));this.afterPath=callback}
  setDirection(x:number,y:number){this.direction.set(x,y);if(x||y){this.path=[];this.afterPath=undefined}}
  override update(_:number,delta:number){
    if(!this.self)return
    const sprite=this.self.sprite
    let vx=this.direction.x,vy=this.direction.y
    const el=document.activeElement?.tagName
    if(el!=='INPUT'&&el!=='TEXTAREA'&&this.keys){
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
    this.self.label.setPosition(sprite.x,sprite.y-27)
    sprite.setDepth(sprite.y+10);this.self.label.setDepth(sprite.y+11)
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
        remote={sprite:this.add.image(p.x,p.y,p.avatar).setDepth(p.y+10),label:this.add.text(p.x,p.y-27,p.nickname,{fontFamily:'monospace',fontSize:'10px',color:'#3c2d1e',backgroundColor:'#fff5df',padding:{x:3,y:2}}).setOrigin(.5).setDepth(p.y+11)}
        this.remotes.set(p.id,remote)
      }
      this.tweens.killTweensOf(remote.sprite)
      this.tweens.add({targets:remote.sprite,x:p.x,y:p.y,duration:115,onUpdate:()=>{remote!.label.setPosition(remote!.sprite.x,remote!.sprite.y-27);remote!.sprite.setDepth(remote!.sprite.y+10);remote!.label.setDepth(remote!.sprite.y+11)}})
    }
  }
  showBubble(id:string,text:string){
    if(id===this.selfId && this.self){
      this.selfBubble?.destroy()
      const sprite=this.self.sprite
      const bubble=this.add.text(sprite.x,sprite.y-53,text.slice(0,32),{fontFamily:'monospace',fontSize:'10px',color:'#3c281e',backgroundColor:'#fff6de',padding:{x:6,y:4},wordWrap:{width:140}}).setOrigin(.5).setDepth(900)
      this.selfBubble=bubble
      this.time.delayedCall(3500,()=>{if(this.selfBubble===bubble)this.selfBubble=undefined;bubble.destroy()})
      return
    }
    const target=this.remotes.get(id)
    if(!target)return
    target.bubble?.destroy()
    const bubble=this.add.text(target.sprite.x,target.sprite.y-53,text.slice(0,32),{fontFamily:'monospace',fontSize:'10px',color:'#3c281e',backgroundColor:'#fff6de',padding:{x:6,y:4},wordWrap:{width:140}}).setOrigin(.5).setDepth(900)
    target.bubble=bubble
    this.time.delayedCall(3500,()=>{if(target.bubble===bubble)target.bubble=undefined;bubble.destroy()})
  }
}
export function createGame(el:HTMLElement,opts:Options):StoreGame{
  const scene=new StoreScene(opts)
  const game=new Phaser.Game({type:Phaser.AUTO,parent:el,width:W,height:H,backgroundColor:'#d0a377',pixelArt:true,
    scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:W,height:H},scene:[scene],render:{antialias:false}})
  return {game,setDirection:(x,y)=>scene.setDirection(x,y),setPlayers:(players,id)=>{if(scene.sys?.isActive())scene.setPlayers(players,id)},showBubble:(id,t)=>{if(scene.sys?.isActive())scene.showBubble(id,t)},setBoard:(orders)=>{if(scene.sys?.isActive())scene.setBoard(orders)}}
}
