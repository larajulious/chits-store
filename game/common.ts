import Phaser from 'phaser'
import type {Pose} from '../shared/world'
import type {OrderStatus} from '../shared/order-status'
import {reactionOptions} from '../shared/reactions'
import * as art from './pixelArt'

// Shared by the store and the neighborhood scenes, so both look and behave like one game.
export type Player = { id:string;nickname:string;avatar:string;x:number;y:number;pose?:Pose;seat?:number }
export type BoardOrder = { id:number;number:string;name:string|null;status:OrderStatus }
// What every scene offers the page: movement, presence, bubbles, and the door transition.
export type WorldGame = {game:Phaser.Game;setDirection:(x:number,y:number)=>void;setPlayers:(players:Player[],selfId:string)=>void;movePlayer:(id:string,x:number,y:number)=>void;showBubble:(id:string,text:string)=>void;setReducedMotion:(value:boolean)=>void;setControlsEnabled:(value:boolean)=>void;
  // The door opens and the screen fades; resolves when the visitor can be moved to the other scene.
  exitScene:()=>Promise<void>;
  // The move was refused or timed out: close the door and fade back in.
  cancelExit:()=>void;
  // The stage changed shape: show this many world units across (see viewWidthFor).
  setViewWidth:(width:number)=>void}
export const PX=art.ART_SCALE
export {MAX_VIEW_W,MIN_VIEW_W,VIEW_H} from '../shared/world'
export const FONT='Silkscreen, monospace'
export const NAME_TAG_GAP=28,BUBBLE_GAP=54,TAG_FONT=10,TAG_PAD_Y=4
// The colour both scenes fade through, matching the wooden frame around the canvas.
export const FADE_COLOR=[110,74,49] as const
export const FADE_MS=260
// Name tags draw above every character and piece of furniture (still ordered by y), below chat bubbles.
export const tagDepth=(y:number)=>600+y/10
export function characterPhase(id:string){let hash=0;for(const char of id)hash=(hash*31+char.charCodeAt(0))>>>0;return hash%6000}
// Phaser queues a full display-list sort on every setDepth call, even if the value is unchanged.
export function setDepthIfChanged(object:{depth:number;setDepth:(value:number)=>unknown},depth:number){if(object.depth!==depth)object.setDepth(depth)}
// Walk and idle frames every visitor shares: a two-step walk with a one-pixel bob, a slow breath and a blink.
export function visitorFrame(avatar:string,phase:number,now:number,moving:boolean){
  const time=now+phase
  if(moving){const step=Math.floor(time/130)%4;return {texture:step===1?`${avatar}-step1`:step===3?`${avatar}-step2`:avatar,lift:step%2?PX:0}}
  return {texture:time%(3800+phase%1800)<130?`${avatar}-blink`:avatar,lift:Math.floor(time/900)%2?PX/2:0}
}
// Both scenes follow the store's Manila clock: day 6:00-17:00, dusk around sunrise (5:00) and sunset (17:00-19:00), night otherwise.
export type Daylight='day'|'dusk'|'night'
export function currentDaylight(now=new Date()):Daylight{
  const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Manila',hour:'numeric',hourCycle:'h23'}).format(now))
  return hour>=6&&hour<17?'day':hour===5||(hour>=17&&hour<19)?'dusk':'night'
}
// Halloween decorations stay up through Undas (Nov 1-2), on the store's Manila calendar.
export function isHalloweenSeason(now=new Date()){
  const [month,day]=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Manila',month:'numeric',day:'numeric'}).format(now).split('/').map(Number)
  return month===10||(month===11&&day!<=2)
}
export function addTexture(scene:Phaser.Scene,name:string,pixels:art.PixelArt){if(!scene.textures.exists(name))scene.textures.addCanvas(name,pixels.toCanvas())}
// The four emote reactions, drawn as small cream cards for speech bubbles.
export function createReactionTextures(scene:Phaser.Scene){
  for(const reaction of reactionOptions){
    if(scene.textures.exists(`reaction-${reaction.id}`))continue
    const pixels=new art.PixelArt(20,20)
    pixels.rect(0,1,20,18,'#674731').rect(1,0,18,20,'#674731').rect(1,1,18,18,'#fff3da')
    for(const [x,y,width,height,color] of reaction.pixels)pixels.rect(2+x,2+y,width,height,`#${color.toString(16).padStart(6,'0')}`)
    addTexture(scene,`reaction-${reaction.id}`,pixels)
  }
}
export function reactionTexture(text:string){const reaction=reactionOptions.find(option=>option.emoji===text);return reaction?`reaction-${reaction.id}`:undefined}

// Breadth-first search over a grid of `cell` world units; `allowed` checks a world point.
const key=(x:number,y:number)=>`${x}|${y}`
export function findPath(start:Phaser.Math.Vector2,target:Phaser.Math.Vector2,allowed:(x:number,y:number)=>boolean,cell=20){
  const toGrid=(p:Phaser.Math.Vector2)=>({x:Math.round(p.x/cell),y:Math.round(p.y/cell)})
  const startGrid=toGrid(start),targetGrid=toGrid(target)
  const open=(x:number,y:number)=>allowed(x*cell,y*cell)
  if(!open(targetGrid.x,targetGrid.y))return []
  const q=[startGrid],seen=new Set([key(startGrid.x,startGrid.y)]),prev=new Map<string,string>()
  const dirs=[[1,0],[-1,0],[0,1],[0,-1]] as const
  for(let i=0;i<q.length;i++){
    const c=q[i]!;if(c.x===targetGrid.x&&c.y===targetGrid.y)break
    for(const [dx,dy] of dirs){const nx=c.x+dx,ny=c.y+dy,k=key(nx,ny)
      if(!seen.has(k)&&open(nx,ny)){seen.add(k);prev.set(k,key(c.x,c.y));q.push({x:nx,y:ny})}}
  }
  const end=key(targetGrid.x,targetGrid.y)
  if(!seen.has(end))return []
  const seq:Phaser.Math.Vector2[]=[];let current=end
  while(current!==key(startGrid.x,startGrid.y)){
    const [x,y]=current.split('|').map(Number) as [number,number];seq.push(new Phaser.Math.Vector2(x*cell,y*cell));current=prev.get(current)!}
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
export class Tag extends Phaser.GameObjects.Container{
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

// Four small pixel sparks: confirms a tap without moving the camera or adding lasting effects.
export function tapSparks(scene:Phaser.Scene,x:number,y:number){
  const spark=scene.add.graphics({x:Math.round(x/PX)*PX,y:Math.round(y/PX)*PX}).setDepth(950)
  const progress={value:0}
  scene.tweens.add({targets:progress,value:1,duration:260,onUpdate:()=>{
    const d=Math.round(2+progress.value*4)*PX/2
    spark.clear().fillStyle(0xfff6dc,1-progress.value).fillRect(-d-PX,-PX/2,PX,PX).fillRect(d,-PX/2,PX,PX).fillRect(-PX/2,-d-PX,PX,PX).fillRect(-PX/2,d,PX,PX)
  },onComplete:()=>spark.destroy()})
}

// Slides a door sprite through its frames (`${prefix}-0` closed .. `${prefix}-3` open), one every 90 ms.
export function slideDoor(scene:Phaser.Scene,door:Phaser.GameObjects.Image,prefix:string,open:boolean,instant:boolean,done?:()=>void){
  const frames=open?[1,2,3]:[2,1,0]
  if(instant){door.setTexture(`${prefix}-${open?3:0}`);done?.();return}
  frames.forEach((frame,i)=>scene.time.delayedCall(i*90,()=>{if(door.active)door.setTexture(`${prefix}-${frame}`);if(i===frames.length-1)done?.()}))
}
