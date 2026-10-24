<script setup lang="ts">
import { orderStatusLabels,type OrderStatus } from '../../shared/order-status'
type BoardOrder={id:number;number:string;name:string|null;status:OrderStatus}
const statuses:OrderStatus[]=['Preparing','Ready','Served']
const dialog=ref<HTMLDialogElement|null>(null)
const headingId=useId()
const orders=ref<BoardOrder[]>([]),loading=ref(false),loadError=ref('')
async function load(){
  loading.value=true;loadError.value=''
  try{orders.value=await $fetch<BoardOrder[]>('/api/orders/board')}
  catch{loadError.value='Could not load live orders right now.'}
  finally{loading.value=false}
}
function open(){if(dialog.value?.open)return;dialog.value?.showModal();void load()}
function close(){dialog.value?.close()}
defineExpose({open,close})
</script>
<template>
  <dialog ref="dialog" class="live-orders-dialog" :aria-labelledby="headingId">
    <div class="live-orders-content">
      <span class="live-orders-icon" aria-hidden="true"><StoreGlyph name="orders"/></span>
      <h2 :id="headingId">Live orders</h2>
      <p class="live-orders-note">Here’s what’s cooking at Chits Meryenda Hub right now.</p>
      <p v-if="loadError" class="live-orders-error" role="alert">{{ loadError }}</p>
      <div v-else class="live-orders-groups" aria-live="polite">
        <section v-for="status in statuses" :key="status" class="live-orders-group" :aria-label="`${orderStatusLabels[status]} orders`">
          <div class="live-orders-heading"><strong>{{ orderStatusLabels[status] }}</strong><span>{{ orders.filter(o=>o.status===status).length }}</span></div>
          <div class="live-orders-chips">
            <span v-for="o in orders.filter(o=>o.status===status)" :key="o.id" class="live-orders-chip" :class="{ready:status==='Ready',served:status==='Served'}"><strong>{{ o.number }}</strong><small v-if="o.name">{{ o.name }}</small></span>
            <small v-if="!orders.some(o=>o.status===status)" class="live-orders-empty">{{ loading?'Loading…':'No orders' }}</small>
          </div>
        </section>
      </div>
      <div class="live-orders-actions">
        <button type="button" class="visit-button secondary" :disabled="loading" @click="load">{{ loading?'Refreshing…':'Refresh' }}</button>
        <button type="button" class="visit-button" autofocus @click="close">Got it</button>
      </div>
    </div>
  </dialog>
</template>
<style scoped>
.live-orders-dialog{position:fixed;inset:0;margin:auto;width:min(460px,calc(100vw - 32px));max-height:calc(100dvh - 48px);padding:24px;border:3px solid #674731;border-radius:0;background:#fff3da;color:#493425;box-shadow:6px 6px 0 #34281b;font-family:'Courier New',monospace;overflow:auto}
.live-orders-dialog::backdrop{background:#34281bb3}
.live-orders-content{display:grid;gap:14px;justify-items:center;text-align:center;min-width:0}
.live-orders-icon{display:grid;place-items:center;width:58px;height:58px;border:2px solid #987047;background:#ecd8b1;box-shadow:3px 3px 0 #d0af7c}.live-orders-icon svg{width:28px;height:28px}
.live-orders-dialog h2{font-family:Silkscreen,monospace;font-size:21px;font-weight:400;line-height:1.4;margin:0}
.live-orders-note{font-size:13px;line-height:1.6;color:#7d654c;margin:0}
.live-orders-error{font-size:14px;color:#9b3a2a;margin:0}
.live-orders-groups{display:grid;gap:10px;width:100%;text-align:left}
.live-orders-group{padding:10px 12px;border:2px solid #d0af7c;background:#fbe9c6}
.live-orders-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;font-size:13px}.live-orders-heading span{min-width:26px;padding:2px 6px;border:2px solid #987047;background:#ecd8b1;text-align:center;font-weight:700}
.live-orders-chips{display:flex;flex-wrap:wrap;gap:6px}
.live-orders-chip{display:inline-flex;align-items:baseline;gap:6px;padding:4px 8px;border:2px solid #987047;background:#fff6de;font-size:13px;overflow-wrap:anywhere}.live-orders-chip small{color:#7d654c}
.live-orders-chip.ready{border-color:#6c875d;background:#e4eed6}.live-orders-chip.served{border-color:#8a7a9c;background:#ece6f2}
.live-orders-empty{font-size:12px;color:#9a836a}
.live-orders-actions{display:grid;grid-template-columns:1fr 1fr;gap:12px;width:100%;margin-top:4px}
.visit-button{width:100%;min-height:46px;padding:12px;border:2px solid #674731;border-radius:0;box-shadow:3px 3px 0 #b58b5e;background:#965b3b;color:#fff6de;font-family:Silkscreen,monospace;font-size:11px;line-height:1.5}.visit-button.secondary{background:#f4dfb6;color:#674731}.visit-button:hover{filter:brightness(1.06)}.visit-button:active{transform:translate(2px,2px);box-shadow:1px 1px 0 #b58b5e}.visit-button:focus-visible{outline:3px solid #6c875d;outline-offset:4px}.visit-button:disabled{opacity:.7}
@media(max-height:560px){.live-orders-dialog{padding:16px}.live-orders-content{gap:10px}.live-orders-icon{display:none}}
</style>
