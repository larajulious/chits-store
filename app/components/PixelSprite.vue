<script lang="ts">
import {uiSpriteArt} from '../../game/pixelArt'
// Sprites are drawn once per name and reused as data URLs.
const cache=new Map<string,{src:string;width:number;height:number}>()
function sprite(name:string){
  if(!cache.has(name)){const art=uiSpriteArt(name);if(!art)return undefined;cache.set(name,{src:art.toCanvas().toDataURL(),width:art.width,height:art.height})}
  return cache.get(name)
}
</script>
<script setup lang="ts">
const props=withDefaults(defineProps<{name:string;scale?:number}>(),{scale:2})
const image=computed(()=>sprite(props.name))
</script>
<template><img v-if="image" class="pixel-sprite" :src="image.src" :width="image.width*props.scale" :height="image.height*props.scale" alt="" aria-hidden="true" draggable="false"></template>
<style scoped>.pixel-sprite{display:block;image-rendering:pixelated;flex-shrink:0}</style>
