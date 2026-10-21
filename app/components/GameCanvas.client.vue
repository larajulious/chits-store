<script setup lang="ts">
import type { Player, BoardOrder, StoreGame } from '../../game/createGame'
import type { MascotSnapshot } from '../../shared/store-mascot'
const props=defineProps<{nickname:string;avatar:string;players:Player[];selfId:string;board:BoardOrder[];mascot:MascotSnapshot|null;controlsEnabled?:boolean}>()
const emit=defineEmits<{(e:'move',pos:{x:number;y:number}):void;(e:'interact',kind:string):void;(e:'yarn',event:{type:string;x?:number;y?:number;vx?:number;vy?:number}):void}>()
const target=ref<HTMLElement>()
let api:StoreGame|undefined
let disposed=false,ready=false
let pendingStaffMessage:string|undefined
let motionQuery:MediaQueryList|undefined
function motionChanged(event:MediaQueryListEvent){api?.setReducedMotion(event.matches)}
const joystick=ref<HTMLElement>()
const joyX=ref(0),joyY=ref(0)
onMounted(async()=>{
  if(!target.value)return
  const {createGame}=await import('../../game/createGame')
  if(disposed||!target.value)return
  motionQuery=window.matchMedia('(prefers-reduced-motion: reduce)')
  api=createGame(target.value,{nickname:props.nickname,avatar:props.avatar as any,onMove:(x,y)=>emit('move',{x,y}),onInteract:kind=>emit('interact',kind),onYarn:event=>emit('yarn',event),reducedMotion:motionQuery.matches,controlsEnabled:props.controlsEnabled!==false})
  motionQuery.addEventListener('change',motionChanged)
  api.game.events.once('ready',()=>{ready=true;api?.setPlayers(props.players,props.selfId);api?.setBoard(props.board);if(props.mascot)api?.setMascot(props.mascot);if(pendingStaffMessage!==undefined){api?.showStaffBubble(pendingStaffMessage);pendingStaffMessage=undefined}})
})
onBeforeUnmount(()=>{disposed=true;ready=false;pendingStaffMessage=undefined;motionQuery?.removeEventListener('change',motionChanged);api?.game.destroy(true);api=undefined})
watch(()=>[props.players,props.selfId] as const,()=>api?.setPlayers(props.players,props.selfId),{deep:true})
watch(()=>props.board,()=>api?.setBoard(props.board),{deep:true})
watch(()=>props.mascot,snapshot=>{if(snapshot)api?.setMascot(snapshot)})
watch(()=>props.controlsEnabled,enabled=>{end();api?.setControlsEnabled(enabled!==false)})
function direction(e:PointerEvent){if(!joystick.value)return;const r=joystick.value.getBoundingClientRect();const x=e.clientX-(r.left+r.width/2),y=e.clientY-(r.top+r.height/2),l=Math.hypot(x,y),scale=l>38?38/l:1;joyX.value=x*scale;joyY.value=y*scale;api?.setDirection(joyX.value/38,joyY.value/38)}
function start(e:PointerEvent){(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);direction(e)}
function end(){joyX.value=joyY.value=0;api?.setDirection(0,0)}
function showStaffBubble(text:string){if(disposed)return;if(ready)api?.showStaffBubble(text);else pendingStaffMessage=text}
defineExpose({showBubble:(id:string,text:string)=>api?.showBubble(id,text),showStaffBubble})
</script>
<template>
  <div class="game-mount" ref="target" aria-label="Interactive bakery game"/>
  <div ref="joystick" class="game-joystick" role="group" aria-label="Virtual movement joystick" @pointerdown.prevent="start" @pointermove.prevent="e=>{if(e.buttons)direction(e)}" @pointerup="end" @pointercancel="end" @lostpointercapture="end"><div class="joystick-knob" :style="{transform:`translate(${joyX}px,${joyY}px)`}"/></div>
</template>
