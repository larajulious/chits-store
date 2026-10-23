<script setup lang="ts">
import {vendingProducts,type VendingProduct} from '../../shared/world'
// A just-for-fun drinks machine on the street. Nothing is ordered or charged; products come from shared/world.ts.
// menuAvailable: false while the store is closed, so there is no menu to point to.
// holding: the drink already in hand; one at a time, so the machine asks for the bin first.
const props=withDefaults(defineProps<{menuAvailable?:boolean;holding?:string|null}>(),{menuAvailable:true,holding:null})
const emit=defineEmits<{vend:[product:VendingProduct];menu:[]}>()
const dispensing=ref<VendingProduct|null>(null),served=ref<VendingProduct|null>(null),drop=ref(0)
let timer:ReturnType<typeof setTimeout>|undefined
const lines:Record<string,string>={buko:'Fresh from the coconut!',calamansi:'Asim-kilig! So refreshing.',gulaman:'Sweet, cold and chewy.',mango:'Sunshine in a cup.',choco:'Creamy and ice cold.'}
const shown=computed(()=>dispensing.value??served.value)
function choose(product:VendingProduct){
  if(product.soon||dispensing.value||props.holding)return
  dispensing.value=product;served.value=null;drop.value++
  emit('vend',product)
  clearTimeout(timer);timer=setTimeout(()=>{served.value=product;dispensing.value=null},900)
}
onBeforeUnmount(()=>clearTimeout(timer))
</script>
<template>
  <div class="vending-panel">
    <p class="vending-intro">Pick a cold drink! This one is just for fun.{{ menuAvailable?' Real meryenda orders are on Today’s Menu.':'' }}</p>
    <div class="vending-machine">
      <div class="vending-window" role="group" aria-label="Drinks">
        <button v-for="product in vendingProducts" :key="product.id" type="button" class="vending-slot" :class="{soon:product.soon,active:dispensing?.id===product.id}" :disabled="product.soon||!!dispensing||!!holding" :aria-label="product.soon?`${product.label}, coming soon`:`Get a ${product.label}`" @click="choose(product)">
          <span class="vending-can" :style="{'--can':product.can,'--band':product.band}" aria-hidden="true"/>
          <span class="vending-name">{{ product.label }}</span>
          <small>{{ product.soon?'SOON':'FREE' }}</small>
        </button>
      </div>
      <div class="vending-tray" aria-hidden="true"><span v-if="shown" :key="drop" class="vending-can dropped" :style="{'--can':shown.can,'--band':shown.band}"/></div>
    </div>
    <p class="vending-status" role="status">{{ dispensing?'Clunk… clunk…':served?`Here’s your ${served.label}! ${lines[served.id]??''} Tap Sip to drink it.`:holding?'Your hands are full. Throw your drink in the bin by the bench first.':'Tap a drink to get it.' }}</p>
    <button v-if="menuAvailable" type="button" class="btn small secondary dialog-action" @click="emit('menu')">See today’s menu</button>
  </div>
</template>
<style scoped>
.vending-panel{display:grid;gap:12px;min-width:0}
.vending-intro,.vending-status{margin:0;font:13px/1.6 'Courier New',monospace;color:#493425}
.vending-status{min-height:42px;font-family:Silkscreen,monospace;font-size:10px;line-height:1.7;color:#674731}
.vending-machine{display:grid;gap:8px;padding:10px;border:3px solid #3d2a1e;background:#c8553d;box-shadow:inset -6px 0 #a8432f,3px 3px 0 #34281b}
.vending-window{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;padding:8px;border:2px solid #3d2a1e;background:#3b3d44;box-shadow:inset 0 2px #55575f}
.vending-slot{display:grid;justify-items:center;gap:5px;min-width:0;min-height:86px;padding:8px 3px 6px;border:2px solid #55575f;background:#4a4c55;color:#fff1cf;font:9px/1.25 Silkscreen,monospace;text-align:center;cursor:pointer}
.vending-slot small{padding:1px 4px;background:#ffd45e;color:#3d2a1e;font:8px/1.3 Silkscreen,monospace}
.vending-slot:hover:not(:disabled){border-color:#ffd45e}
.vending-slot:active:not(:disabled){transform:translateY(2px)}
.vending-slot.active{border-color:#a9ec8f;background:#55575f}
.vending-slot:disabled{cursor:default}.vending-slot.soon{opacity:.55}.vending-slot.soon small{background:#c9b89a}
.vending-slot:focus-visible{outline:3px solid #a9ec8f;outline-offset:1px}
.vending-name{min-width:0;overflow-wrap:anywhere}
/* A pixel can: lid, coloured body and a label band, drawn with hard-stop gradients. */
.vending-can{display:block;width:16px;height:24px;border:2px solid #3d2a1e;background:linear-gradient(#d9d2c4 0 3px,var(--can) 3px 9px,var(--band) 9px 13px,var(--can) 13px);box-shadow:inset 3px 0 #ffffff66}
.vending-tray{display:grid;place-items:center;height:44px;border:2px solid #3d2a1e;background:#2b1d16;box-shadow:inset 0 3px #55575f;overflow:hidden}
.vending-can.dropped{animation:can-drop .5s steps(5,end) both}
@keyframes can-drop{0%{transform:translateY(-40px)}60%{transform:translateY(4px)}80%{transform:translateY(-3px)}100%{transform:translateY(0)}}
@media(prefers-reduced-motion:reduce){.vending-can.dropped{animation:none}.vending-slot:active:not(:disabled){transform:none}}
@media(max-width:360px){.vending-slot{min-height:78px;font-size:8px}}
</style>
