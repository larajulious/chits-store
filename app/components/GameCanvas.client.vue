<script setup lang="ts">
import type { Player, BoardOrder, StoreGame, JukeboxScene } from '../../game/createGame'
import type { NeighborhoodGame } from '../../game/neighborhood'
import type { CatName, CatTaps } from '../../shared/store-mascot'
import { VIEW_H, viewWidthFor, type Pose, type SceneId } from '../../shared/world'
const props=defineProps<{scene?:SceneId;daylight?:'day'|'dusk'|'night';nickname:string;avatar:string;players:Player[];selfId:string;board:BoardOrder[];catEnabled?:boolean;guideEnabled?:boolean;controlsEnabled?:boolean;jukebox?:JukeboxScene;menuItems?:string[]|null;catTaps?:CatTaps|null}>()
const emit=defineEmits<{(e:'move',pos:{x:number;y:number}):void;(e:'interact',kind:string):void;(e:'catTap',name:CatName):void;(e:'pose',pose:{pose:Pose;seat?:number}):void;(e:'ready',scene:SceneId):void}>()
const target=ref<HTMLElement>()
// Only one scene's game exists at a time: `api` is whichever is running, `store`/`street` the same object when it's that scene.
let api:StoreGame|NeighborhoodGame|undefined,store:StoreGame|undefined,street:NeighborhoodGame|undefined
let disposed=false,ready=false,generation=0
let pendingStaffMessage:string|undefined
let motionQuery:MediaQueryList|undefined
const catAudio:Partial<Record<CatName,HTMLAudioElement>>={}
function motionChanged(event:MediaQueryListEvent){api?.setReducedMotion(event.matches)}
function visibilityChanged(){if(!api)return;if(document.hidden)api.game.loop.sleep();else api.game.loop.wake()}
// Each cat has its own voice: Miming meows, Onay trills. Sound effects stay separate from jukebox music.
const catSounds:Record<CatName,string>={Miming:'/Playful_meow_from_a_curious_kitten.mp3',Onay:'/Soothing_trilling_sounds_of_a_content_cat.mp3'}
function playCatSound(name:CatName){
  const audio=catAudio[name]??=new Audio(catSounds[name])
  audio.volume=.55
  audio.currentTime=0
  void audio.play().catch(()=>{})
}
// Phaser measures text when it is created, so the in-scene pixel font must be ready first.
async function loadPixelFont(){try{await Promise.race([document.fonts.load('8px Silkscreen'),new Promise(resolve=>setTimeout(resolve,1500))])}catch{}}
// The game fills the stage edge to edge: the view is 580 world units tall and as wide as the stage's shape allows.
let viewWidth=360,resizeObserver:ResizeObserver|undefined,resizeTimer:ReturnType<typeof setTimeout>|undefined
function measureView(el:HTMLElement){const {width,height}=el.getBoundingClientRect();return viewWidthFor(width,height)}
// Whole-number zoom nearest the canvas's device pixels, kept under ~6 megapixels so very large screens stay smooth.
function renderZoom(el:HTMLElement,view:number){
  const {width,height}=el.getBoundingClientRect()
  const devicePixels=Math.min(width/view,height/VIEW_H)*(window.devicePixelRatio||1)
  let zoom=devicePixels>0?Math.max(1,Math.min(4,Math.floor(devicePixels+.15))):2
  while(zoom>1&&view*VIEW_H*zoom*zoom>6_000_000)zoom--
  return zoom
}
// Resizing or rotating reshapes the running scene in place; the zoom chosen at creation stays.
function stageResized(){
  clearTimeout(resizeTimer)
  resizeTimer=setTimeout(()=>{if(!target.value||!api)return;const next=measureView(target.value);if(next!==viewWidth){viewWidth=next;api.setViewWidth(next)}},120)
}
const joystick=ref<HTMLElement>()
const joyX=ref(0),joyY=ref(0)
// arriving: the visitor came through a door (not a page load), so the new scene plays its arrival.
async function mountGame(arriving:boolean){
  const id=++generation,scene=props.scene??'store',fontReady=loadPixelFont()
  // The street is its own chunk, downloaded the first time a visitor steps outside.
  const module=scene==='outside'?await Promise.all([import('../../game/neighborhood'),fontReady]).then(([m])=>m):await Promise.all([import('../../game/createGame'),fontReady]).then(([m])=>m)
  if(disposed||id!==generation||!target.value)return
  viewWidth=measureView(target.value)
  const options={nickname:props.nickname,avatar:props.avatar as any,onMove:(x:number,y:number)=>emit('move',{x,y}),onInteract:(kind:string)=>emit('interact',kind),reducedMotion:motionQuery?.matches,controlsEnabled:props.controlsEnabled!==false,zoom:renderZoom(target.value,viewWidth),viewWidth,arriving}
  if('createNeighborhood' in module)api=street=module.createNeighborhood(target.value,{...options,onPose:(pose,seat)=>emit('pose',{pose,seat}),daylight:props.daylight})
  else api=store=module.createGame(target.value,{...options,onCatMeow:playCatSound,onCatTap:name=>emit('catTap',name),catEnabled:props.catEnabled,guideEnabled:props.guideEnabled,daylight:props.daylight})
  const created=api
  visibilityChanged()
  created.game.events.once('ready',()=>{
    if(id!==generation)return
    ready=true
    created.setPlayers(props.players,props.selfId);created.setBoard(props.board);created.setControlsEnabled(props.controlsEnabled!==false)
    if(props.jukebox)store?.setJukebox(props.jukebox);store?.setMenuItems(props.menuItems??null);if(props.catTaps)store?.setCatTaps(props.catTaps)
    if(pendingStaffMessage!==undefined){store?.showStaffBubble(pendingStaffMessage);pendingStaffMessage=undefined}
    emit('ready',scene)
  })
}
function disposeGame(){generation++;ready=false;api?.game.destroy(true);api=store=street=undefined}
onMounted(()=>{
  if(!target.value)return
  motionQuery=window.matchMedia('(prefers-reduced-motion: reduce)')
  motionQuery.addEventListener('change',motionChanged)
  document.addEventListener('visibilitychange',visibilityChanged)
  resizeObserver=new ResizeObserver(stageResized);resizeObserver.observe(target.value)
  void mountGame(false)
})
onBeforeUnmount(()=>{disposed=true;resizeObserver?.disconnect();clearTimeout(resizeTimer);pendingStaffMessage=undefined;motionQuery?.removeEventListener('change',motionChanged);document.removeEventListener('visibilitychange',visibilityChanged);for(const audio of Object.values(catAudio))audio.pause();disposeGame()})
// Walking through a door: the old scene's game is destroyed before the new one is built.
watch(()=>props.scene,()=>{if(disposed||!motionQuery)return;end();disposeGame();void mountGame(true)})
watch(()=>[props.players,props.selfId] as const,()=>api?.setPlayers(props.players,props.selfId))
watch(()=>props.board,()=>api?.setBoard(props.board),{deep:true})
watch(()=>props.menuItems,items=>store?.setMenuItems(items??null))
watch(()=>props.jukebox,state=>{if(state)store?.setJukebox(state)})
watch(()=>props.catTaps,taps=>{if(taps&&ready)store?.setCatTaps(taps)})
watch(()=>props.controlsEnabled,enabled=>{end();api?.setControlsEnabled(enabled!==false)})
// Knob travel in CSS pixels; matches the compact pixel joystick ring.
const JOY_RANGE=24
function direction(e:PointerEvent){if(!joystick.value)return;const r=joystick.value.getBoundingClientRect();const x=e.clientX-(r.left+r.width/2),y=e.clientY-(r.top+r.height/2),l=Math.hypot(x,y),scale=l>JOY_RANGE?JOY_RANGE/l:1;joyX.value=x*scale;joyY.value=y*scale;api?.setDirection(joyX.value/JOY_RANGE,joyY.value/JOY_RANGE)}
function start(e:PointerEvent){(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);direction(e)}
function end(){joyX.value=joyY.value=0;api?.setDirection(0,0)}
function showStaffBubble(text:string){if(disposed)return;if(ready)store?.showStaffBubble(text);else if((props.scene??'store')==='store')pendingStaffMessage=text}
defineExpose({showBubble:(id:string,text:string)=>api?.showBubble(id,text),showStaffBubble,movePlayer:(id:string,x:number,y:number)=>api?.movePlayer(id,x,y),tossYarn:()=>store?.tossYarn(),petCat:()=>store?.petCat(),
  exitScene:()=>api?.exitScene()??Promise.resolve(),cancelExit:()=>api?.cancelExit(),setPose:(id:string,pose:Pose,seat?:number)=>street?.setPose(id,pose,seat),vend:()=>street?.vend(),goInside:()=>street?.goInside()})
</script>
<template>
  <div class="game-mount" ref="target" :aria-label="scene==='outside'?'Interactive neighborhood street':'Interactive bakery game'"/>
  <div ref="joystick" class="game-joystick" role="group" aria-label="Virtual movement joystick" @pointerdown.prevent="start" @pointermove.prevent="e=>{if(e.buttons)direction(e)}" @pointerup="end" @pointercancel="end" @lostpointercapture="end"><div class="joystick-knob" :style="{transform:`translate(${joyX}px,${joyY}px)`}"/></div>
</template>
