<script setup lang="ts">
import {reactionOptions} from '../../shared/reactions'
const props=defineProps<{emoji:string}>()
const reaction=computed(()=>reactionOptions.find(option=>option.emoji===props.emoji))
const color=(value:number)=>`#${value.toString(16).padStart(6,'0')}`
</script>
<template><svg v-if="reaction" viewBox="0 0 16 16" width="32" height="32" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><rect v-for="(pixel,i) in reaction.pixels" :key="i" :x="pixel[0]" :y="pixel[1]" :width="pixel[2]" :height="pixel[3]" :fill="color(pixel[4])"/></svg></template>
