<script setup lang="ts">
import {BARISTA_GREETING,drinkOptions,type DrinkId} from '../../shared/cafe'
// The barista's small dialog. Every drink is virtual and free: no checkout, account or payment.
defineProps<{holding?:string|null}>()
const emit=defineEmits<{choose:[drink:DrinkId,surprise:boolean]}>()
function surprise(){emit('choose',drinkOptions[Math.floor(Math.random()*drinkOptions.length)]!.id,true)}
</script>
<template>
  <div class="barista-panel">
    <p class="barista-line"><PixelSprite name="head-barista" :scale="2"/><span>{{ BARISTA_GREETING }}</span></p>
    <div class="drink-choices" role="group" aria-label="Drinks">
      <button v-for="drink in drinkOptions" :key="drink.id" type="button" class="drink-choice" :aria-pressed="holding===drink.id" @click="emit('choose',drink.id,false)">
        <PixelSprite :name="`cup-${drink.id}`" :scale="3"/><span>{{ drink.label }}</span>
      </button>
      <button type="button" class="drink-choice surprise" @click="surprise"><span class="surprise-mark" aria-hidden="true">?</span><span>Surprise Me</span></button>
    </div>
    <p class="barista-note">Libre lahat! Virtual drinks for hanging out. Nothing to pay, nothing to order.</p>
  </div>
</template>
<style scoped>
.barista-panel{display:grid;gap:12px;min-width:0}
.barista-line{display:flex;align-items:center;gap:10px;margin:0;padding:10px;border:2px solid #c7a576;background:#f5e8ce;font:13px/1.5 'Courier New',monospace;color:#493425}
.barista-line .pixel-sprite{flex-shrink:0;width:40px;height:auto}
.drink-choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.drink-choice{display:flex;align-items:center;gap:10px;min-width:0;min-height:56px;padding:8px 10px;border:2px solid #c7a576;background:#fff7e5;color:#674731;font:10px/1.3 Silkscreen,monospace;text-align:left;cursor:pointer;box-shadow:2px 2px 0 #ddc399}
.drink-choice .pixel-sprite{flex-shrink:0;width:27px;height:auto}
.drink-choice[aria-pressed="true"]{border-color:#5f7f5c;background:#e6edce}
.drink-choice:hover{border-color:#8a6446}
.drink-choice:active{transform:translate(2px,2px);box-shadow:none}
.drink-choice.surprise{grid-column:1/-1;justify-content:center;background:#e6edce;border-color:#91aa6f}
.surprise-mark{display:grid;place-items:center;width:24px;height:24px;border:2px solid #3f5a45;background:#fff8ea;color:#3f5a45;font:14px/1 Silkscreen,monospace}
.drink-choice:focus-visible{outline:3px solid #617e4d;outline-offset:2px}
.barista-note{margin:0;font:11px/1.6 'Courier New',monospace;color:#7f684f}
@media(prefers-reduced-motion:reduce){.drink-choice:active{transform:none}}
</style>
