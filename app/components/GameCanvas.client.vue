<script setup lang="ts">
import type { Player, BoardOrder, StoreGame } from '../../game/createGame'
const props=defineProps<{nickname:string;avatar:string;players:Player[];selfId:string;board:BoardOrder[]}>()
const emit=defineEmits<{(e:'move',pos:{x:number;y:number}):void;(e:'interact',kind:string):void}>()
const target=ref<HTMLElement>()
let api:StoreGame|undefined
let disposed=false
const joystick=ref<HTMLElement>()
const joyX=ref(0),joyY=ref(0)
onMounted(async()=>{
  if(!target.value)return
  const {createGame}=await import('../../game/createGame')
  if(disposed||!target.value)return
  api=createGame(target.value,{nickname:props.nickname,avatar:props.avatar as any,onMove:(x,y)=>emit('move',{x,y}),onInteract:kind=>emit('interact',kind)})
  api.game.events.once('ready',()=>{api?.setPlayers(props.players,props.selfId);api?.setBoard(props.board)})
})
onBeforeUnmount(()=>{disposed=true;api?.game.destroy(true);api=undefined})
watch(()=>[props.players,props.selfId] as const,()=>api?.setPlayers(props.players,props.selfId),{deep:true})
watch(()=>props.board,()=>api?.setBoard(props.board),{deep:true})
function direction(e:PointerEvent){if(!joystick.value)return;const r=joystick.value.getBoundingClientRect();const x=e.clientX-(r.left+r.width/2),y=e.clientY-(r.top+r.height/2),l=Math.hypot(x,y),scale=l>38?38/l:1;joyX.value=x*scale;joyY.value=y*scale;api?.setDirection(joyX.value/38,joyY.value/38)}
function start(e:PointerEvent){(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);direction(e)}
function end(){joyX.value=joyY.value=0;api?.setDirection(0,0)}
defineExpose({showBubble:(id:string,text:string)=>api?.showBubble(id,text)})
</script>
<template>
  <div class="game-mount" ref="target" aria-label="Interactive bakery game"/>
  <div ref="joystick" class="game-joystick" role="group" aria-label="Virtual movement joystick" @pointerdown.prevent="start" @pointermove.prevent="e=>{if(e.buttons)direction(e)}" @pointerup="end" @pointercancel="end" @lostpointercapture="end"><div class="joystick-knob" :style="{transform:`translate(${joyX}px,${joyY}px)`}"/></div>
</template>
