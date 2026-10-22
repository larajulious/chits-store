<script setup lang="ts">
import type { Player, BoardOrder, StoreGame, JukeboxScene } from '../../game/createGame'
import type { CatName } from '../../shared/store-mascot'
const props=defineProps<{nickname:string;avatar:string;players:Player[];selfId:string;board:BoardOrder[];catEnabled?:boolean;guideEnabled?:boolean;controlsEnabled?:boolean;jukebox?:JukeboxScene;menuItems?:string[]|null}>()
const emit=defineEmits<{(e:'move',pos:{x:number;y:number}):void;(e:'interact',kind:string):void}>()
const target=ref<HTMLElement>()
let api:StoreGame|undefined
let disposed=false,ready=false
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
// Whole-number zoom nearest the canvas's device pixels (360x580 world units).
function renderZoom(el:HTMLElement){
  const {width,height}=el.getBoundingClientRect()
  const devicePixels=Math.min(width/360,height/580)*(window.devicePixelRatio||1)
  return devicePixels>0?Math.max(1,Math.min(4,Math.floor(devicePixels+.15))):2
}
const joystick=ref<HTMLElement>()
const joyX=ref(0),joyY=ref(0)
onMounted(async()=>{
  if(!target.value)return
  const [{createGame}]=await Promise.all([import('../../game/createGame'),loadPixelFont()])
  if(disposed||!target.value)return
  motionQuery=window.matchMedia('(prefers-reduced-motion: reduce)')
  api=createGame(target.value,{nickname:props.nickname,avatar:props.avatar as any,onMove:(x,y)=>emit('move',{x,y}),onInteract:kind=>emit('interact',kind),onCatMeow:playCatSound,catEnabled:props.catEnabled,guideEnabled:props.guideEnabled,reducedMotion:motionQuery.matches,controlsEnabled:props.controlsEnabled!==false,zoom:renderZoom(target.value)})
  motionQuery.addEventListener('change',motionChanged)
  document.addEventListener('visibilitychange',visibilityChanged)
  visibilityChanged()
  api.game.events.once('ready',()=>{ready=true;api?.setPlayers(props.players,props.selfId);api?.setBoard(props.board);if(props.jukebox)api?.setJukebox(props.jukebox);api?.setMenuItems(props.menuItems??null);if(pendingStaffMessage!==undefined){api?.showStaffBubble(pendingStaffMessage);pendingStaffMessage=undefined}})
})
onBeforeUnmount(()=>{disposed=true;ready=false;pendingStaffMessage=undefined;motionQuery?.removeEventListener('change',motionChanged);document.removeEventListener('visibilitychange',visibilityChanged);for(const audio of Object.values(catAudio))audio.pause();api?.game.destroy(true);api=undefined})
watch(()=>[props.players,props.selfId] as const,()=>api?.setPlayers(props.players,props.selfId))
watch(()=>props.board,()=>api?.setBoard(props.board),{deep:true})
watch(()=>props.menuItems,items=>api?.setMenuItems(items??null))
watch(()=>props.jukebox,state=>{if(state)api?.setJukebox(state)})
watch(()=>props.controlsEnabled,enabled=>{end();api?.setControlsEnabled(enabled!==false)})
// Knob travel in CSS pixels; matches the compact pixel joystick ring.
const JOY_RANGE=24
function direction(e:PointerEvent){if(!joystick.value)return;const r=joystick.value.getBoundingClientRect();const x=e.clientX-(r.left+r.width/2),y=e.clientY-(r.top+r.height/2),l=Math.hypot(x,y),scale=l>JOY_RANGE?JOY_RANGE/l:1;joyX.value=x*scale;joyY.value=y*scale;api?.setDirection(joyX.value/JOY_RANGE,joyY.value/JOY_RANGE)}
function start(e:PointerEvent){(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);direction(e)}
function end(){joyX.value=joyY.value=0;api?.setDirection(0,0)}
function showStaffBubble(text:string){if(disposed)return;if(ready)api?.showStaffBubble(text);else pendingStaffMessage=text}
defineExpose({showBubble:(id:string,text:string)=>api?.showBubble(id,text),showStaffBubble,movePlayer:(id:string,x:number,y:number)=>api?.movePlayer(id,x,y),tossYarn:()=>api?.tossYarn(),petCat:()=>api?.petCat()})
</script>
<template>
  <div class="game-mount" ref="target" aria-label="Interactive bakery game"/>
  <div ref="joystick" class="game-joystick" role="group" aria-label="Virtual movement joystick" @pointerdown.prevent="start" @pointermove.prevent="e=>{if(e.buttons)direction(e)}" @pointerup="end" @pointercancel="end" @lostpointercapture="end"><div class="joystick-knob" :style="{transform:`translate(${joyX}px,${joyY}px)`}"/></div>
</template>
