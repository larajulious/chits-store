<script setup lang="ts">
import type { CustomerOrderSummary, CustomerOrderDetail } from '../../shared/customer-order'
import { orderStatusLabels } from '../../shared/order-status'
import { playChatSound } from '../utils/chatSound'

const props=defineProps<{storeOpen:boolean}>()
const emit=defineEmits<{'session-expired':[];'order-updated':[];'delete-pending':[order:{id:number;number:string}]}>()
const orders=ref<CustomerOrderSummary[]>([]),selectedId=ref<number|null>(null),detail=ref<CustomerOrderDetail|null>(null),draft=ref(''),error=ref(''),sending=ref(false),loading=ref(false),confirming=ref(false),savingName=ref(false),pendingName=ref(''),nameDirty=ref(false)
const unread=computed(()=>orders.value.reduce((sum,order)=>sum+order.unread,0))
let alive=true,initialized=false,polling=false,timer:ReturnType<typeof setInterval>|undefined
function money(cents:number){return `₱${(cents/100).toFixed(2)}`}
async function load(){
  if(!alive||polling)return
  polling=true
  try{
    const next=await $fetch<CustomerOrderSummary[]>('/api/admin/order-inbox')
    if(!alive)return
    const count=next.reduce((sum,order)=>sum+order.unread,0)
    if(initialized&&count>unread.value&&!document.hidden)playChatSound()
    initialized=true;orders.value=next
    if(selectedId.value&&!next.some(order=>order.id===selectedId.value)){selectedId.value=null;detail.value=null}
  }catch(e:any){if(e?.response?.status===401)emit('session-expired')}
  finally{polling=false}
}
async function loadDetail(id:number){
  try{
    const next=await $fetch<CustomerOrderDetail>(`/api/admin/orders/${id}/conversation`)
    if(!alive||selectedId.value!==id)return
    if(!nameDirty.value||detail.value?.order.id!==id)pendingName.value=next.order.name||''
    detail.value=next;orders.value=orders.value.map(order=>order.id===id?{...order,unread:0,status:next.order.status,name:next.order.name}:order)
  }catch(e:any){if(e?.response?.status===401)emit('session-expired');else error.value=e?.data?.statusMessage||'Could not open this order.'}
}
async function select(id:number){selectedId.value=id;detail.value=null;error.value='';nameDirty.value=false;loading.value=true;await loadDetail(id);loading.value=false}
async function poll(){if(document.hidden)return;await load();if(selectedId.value)await loadDetail(selectedId.value)}
async function send(){
  const id=selectedId.value,text=draft.value.trim()
  if(!id||!text||text.length>500||sending.value||!props.storeOpen)return
  sending.value=true;error.value=''
  try{
    const next=await $fetch<CustomerOrderDetail>(`/api/admin/orders/${id}/messages`,{method:'POST',body:{text}})
    if(alive){draft.value='';detail.value=next;await load()}
  }catch(e:any){error.value=e?.data?.statusMessage||'Could not send. Your message is still here.';if(e?.response?.status===401)emit('session-expired')}
  finally{sending.value=false}
}
async function confirm(){
  const id=selectedId.value
  if(!id||detail.value?.order.status!=='Pending'||confirming.value||savingName.value)return
  confirming.value=true;error.value=''
  try{
    await $fetch(`/api/admin/orders/${id}`,{method:'PATCH',body:{status:'Preparing',name:pendingName.value}})
    nameDirty.value=false
    await Promise.all([load(),loadDetail(id)])
    emit('order-updated')
  }catch(e:any){error.value=e?.data?.statusMessage||'Could not confirm this order.';if(e?.response?.status===401)emit('session-expired')}
  finally{confirming.value=false}
}
async function saveName(){
  const id=selectedId.value
  if(!id||detail.value?.order.status!=='Pending'||savingName.value||confirming.value)return
  savingName.value=true;error.value=''
  try{
    await $fetch(`/api/admin/orders/${id}`,{method:'PATCH',body:{name:pendingName.value}})
    nameDirty.value=false
    await Promise.all([load(),loadDetail(id)])
    emit('order-updated')
  }catch(e:any){error.value=e?.data?.statusMessage||'Could not save the order name.';if(e?.response?.status===401)emit('session-expired')}
  finally{savingName.value=false}
}
function removeOrder(id:number){
  orders.value=orders.value.filter(order=>order.id!==id)
  if(selectedId.value===id){selectedId.value=null;detail.value=null;draft.value='';error.value=''}
}
onMounted(()=>{void load();timer=setInterval(()=>void poll(),2000)})
onBeforeUnmount(()=>{alive=false;clearInterval(timer)})
defineExpose({refresh:load,removeOrder})
</script>
<template>
  <section class="card order-private-inbox" aria-labelledby="private-inbox-title">
    <header><h2 id="private-inbox-title"><StoreGlyph name="chat"/> Order inbox <span v-if="unread" class="private-badge" :aria-label="`${unread} unread order messages`">{{ unread>9?'9+':unread }}</span></h2><small>Private customer conversations</small></header>
    <p v-if="orders.length===0" class="help-text">Customer orders and their messages will appear here.</p>
    <div v-else class="private-order-list" aria-label="Customer orders"><button v-for="order in orders" :key="order.id" type="button" :class="{selected:selectedId===order.id}" @click="select(order.id)"><strong>#{{ order.number }} <span v-if="order.unread" class="private-badge">{{ order.unread }}</span></strong><span>{{ order.name||order.visitor }}</span><small>{{ orderStatusLabels[order.status] }} · {{ money(order.totalCentavos) }}</small></button></div>
    <p v-if="loading" class="help-text">Opening order…</p>
    <template v-if="detail&&selectedId===detail.order.id">
      <div class="private-order-summary"><strong>Order #{{ detail.order.number }}{{ detail.order.name?` · ${detail.order.name}`:'' }} · {{ orderStatusLabels[detail.order.status] }}</strong><div v-for="item in detail.items" :key="item.id"><span>{{ item.quantity }} × {{ item.name }}</span><span>{{ money(item.lineTotalCentavos) }}</span></div><div class="private-total"><strong>Total</strong><strong>{{ money(detail.order.totalCentavos) }}</strong></div></div>
      <div v-if="detail.order.status==='Pending'" class="private-name-editor"><form @submit.prevent="saveName"><label for="private-order-name">Order name <span>(optional)</span></label><div><input id="private-order-name" v-model="pendingName" class="input" type="text" maxlength="60" autocomplete="off" placeholder="Customer name" :disabled="savingName||confirming" @input="nameDirty=true"><button type="submit" class="btn small secondary" :disabled="!nameDirty||savingName||confirming">{{ savingName?'Saving…':'Save name' }}</button></div></form><p>Name appears on the live board after confirmation.</p><div class="private-pending-actions"><button type="button" class="btn small private-confirm" :disabled="confirming||savingName" @click="confirm">{{ confirming?'Confirming…':'Confirm order and start preparing' }}</button><button type="button" class="btn small secondary private-delete" :disabled="confirming||savingName" @click="emit('delete-pending',{id:detail.order.id,number:detail.order.number})">Delete pending</button></div></div>
      <div class="private-message-feed" role="log" aria-label="Private order messages" aria-live="polite"><div v-for="entry in detail.messages" :key="entry.id" :class="{staff:entry.role==='staff'}"><strong>{{ entry.role==='system'?'Order':entry.role==='staff'?'Staff':'Customer' }}</strong><span>{{ entry.text }}</span></div></div>
      <form class="private-reply" @submit.prevent="send"><label for="order-reply">Reply to customer</label><div><input id="order-reply" v-model="draft" class="input" maxlength="500" autocomplete="off" placeholder="Message about this order…" :disabled="sending||!storeOpen"><button type="submit" class="btn small" :disabled="sending||!storeOpen||!draft.trim()">{{ sending?'Sending…':'Send' }}</button></div></form>
    </template>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="!storeOpen" class="help-text">Open the store to reply.</p>
  </section>
</template>
<style scoped>
.order-private-inbox{display:grid;gap:12px;min-width:0;font-family:'Courier New',monospace;color:#674731}.order-private-inbox header{display:flex;align-items:start;justify-content:space-between;gap:12px}.order-private-inbox h2{display:flex;align-items:center;gap:7px;margin:0;font:15px/1.5 Silkscreen,monospace}.order-private-inbox h2 svg{width:18px;height:18px}.order-private-inbox header small{color:#80694f;font:10px/1.5 'Courier New',monospace;text-align:right}.private-badge{display:inline-grid;place-items:center;min-width:18px;height:18px;padding:1px 3px;background:#ad513f;color:#fff7e5;font:9px Silkscreen,monospace}.private-order-list{display:flex;gap:7px;min-width:0;overflow-x:auto;padding:2px 3px 7px;overscroll-behavior-x:contain}.private-order-list button{display:grid;gap:4px;flex:0 0 128px;min-height:70px;padding:8px;border:2px solid #c5a678;background:#fff7e5;color:#674731;text-align:left;box-shadow:2px 2px 0 #ddc399}.private-order-list button.selected{background:#ead5ad;border-color:#674731}.private-order-list strong{font:11px Silkscreen,monospace}.private-order-list span,.private-order-list small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px}.private-order-summary{display:grid;gap:6px;padding:10px;border:2px solid #c5a678;background:#f2e4c9;font-size:11px}.private-order-summary>strong{font:10px/1.5 Silkscreen,monospace}.private-order-summary>div{display:flex;justify-content:space-between;gap:8px}.private-order-summary>div span:first-child{overflow-wrap:anywhere}.private-total{padding-top:6px;border-top:1px dashed #b69464;font:10px Silkscreen,monospace}.private-message-feed{display:grid;align-content:start;gap:7px;min-height:100px;max-height:175px;overflow:auto;padding:8px;border:2px solid #c5a678;background:#f2e4c9}.private-message-feed>div{display:grid;gap:4px;padding:7px;border:1px solid #c5a678;background:#fff7e5;font-size:11px;line-height:1.5;overflow-wrap:anywhere}.private-message-feed>div.staff{background:#e6edce;border-color:#91aa6f}.private-message-feed strong{font:9px Silkscreen,monospace}.private-reply{display:grid;gap:6px}.private-reply label{font:9px Silkscreen,monospace}.private-reply>div{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px}.private-reply .input{min-width:0;border:2px solid #b08a5e;border-radius:0;font-family:'Courier New',monospace}.private-reply .btn{border-radius:0;font:10px Silkscreen,monospace}.order-private-inbox .help-text,.order-private-inbox .error{margin:0}.order-private-inbox button:focus-visible,.order-private-inbox input:focus-visible{outline:3px solid #617e4d;outline-offset:3px}
.private-name-editor{display:grid;gap:8px;padding:10px;border:2px solid #c5a678;background:#fff7e5}.private-name-editor form{display:grid;gap:6px}.private-name-editor label{font:9px Silkscreen,monospace}.private-name-editor label span{font-family:'Courier New',monospace}.private-name-editor form>div{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px}.private-name-editor .input{min-width:0;border:2px solid #b08a5e;border-radius:0;font-family:'Courier New',monospace}.private-name-editor p{margin:0;font-size:10px;line-height:1.4;color:#80694f}.private-name-editor .btn{border-radius:0;font:9px/1.4 Silkscreen,monospace}.private-name-editor .private-confirm{width:100%;white-space:normal;min-height:42px}
.private-pending-actions{display:grid;gap:7px}.private-name-editor .private-delete{width:100%;min-height:36px;border-color:#914e3d;background:#f3dbce;color:#773b2f;white-space:normal}
</style>
