<script setup lang="ts">
import {conversationStarters} from '../../shared/cafe'
// The chika board: pick an opener and it lands in your chat box, ready to edit. Nothing is sent for you.
const emit=defineEmits<{use:[text:string]}>()
</script>
<template>
  <div class="chika-board">
    <p class="chika-intro">Need a kwentuhan starter? Pick one and it goes into your chat box. You can edit it before sending.</p>
    <ul class="chika-notes">
      <li v-for="(starter,i) in conversationStarters" :key="starter"><button type="button" :class="`note-${i%4}`" @click="emit('use',starter)"><span>{{ starter }}</span><small>Use →</small></button></li>
    </ul>
  </div>
</template>
<style scoped>
.chika-board{display:grid;gap:12px;min-width:0}
.chika-intro{margin:0;font:12px/1.6 'Courier New',monospace;color:#493425}
.chika-notes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:0;padding:10px;list-style:none;border:3px solid #7a4f31;background:#c99a63;box-shadow:inset 2px 2px 0 #d9ad78;max-height:46dvh;overflow-y:auto}
.chika-notes button{position:relative;display:grid;gap:6px;width:100%;min-height:70px;padding:12px 8px 8px;border:0;background:#fff8ea;color:#493425;font:12px/1.4 'Courier New',monospace;text-align:left;cursor:pointer;box-shadow:2px 2px 0 #8a5c3a}
.chika-notes button::before{content:'';position:absolute;top:3px;left:50%;width:6px;height:6px;margin-left:-3px;background:#d9473f;box-shadow:1px 1px 0 #7a2e22}
.chika-notes .note-1{background:#f3c6c2}.chika-notes .note-2{background:#d8e8c4}.chika-notes .note-3{background:#fff1b0}
.chika-notes small{font:8px/1 Silkscreen,monospace;color:#674731;justify-self:end}
.chika-notes button:hover{transform:translateY(-1px)}
.chika-notes button:focus-visible{outline:3px solid #617e4d;outline-offset:2px}
@media(max-width:360px){.chika-notes{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){.chika-notes button:hover{transform:none}}
</style>
