<script setup lang="ts">
import { orderStatusLabels,orderNextStatus,type OrderStatus } from '../../../shared/order-status'
type Order = { id:number; number:string; status:OrderStatus; createdAt:number }
type RoomState = { chatEnabled:boolean; members:{id:string;visitorId:number;nickname:string;muted:boolean}[] }
const loggedIn=ref(false), checking=ref(true), busy=ref(false), password=ref(''), error=ref(''), newOrder=ref('')
const orders=ref<Order[]>([]), room=ref<RoomState>({chatEnabled:true,members:[]})
const orderFilter=ref<OrderStatus>('Preparing'),updatingId=ref<number|null>(null),refreshing=ref(false),lastRefreshed=ref(''),success=ref('')
const deliveryConfirmation=ref<HTMLDialogElement|null>(null),pendingDelivery=ref<Order|null>(null)
const preparingCount=computed(()=>orders.value.filter(o=>o.status==='Preparing').length)
const readyCount=computed(()=>orders.value.filter(o=>o.status==='Ready').length)
const outForDeliveryCount=computed(()=>orders.value.filter(o=>o.status==='Served').length)
const deliveredCount=computed(()=>orders.value.filter(o=>o.status==='Delivered').length)
const filters=computed(()=>[
  {value:'Preparing' as const,label:'Preparing',count:preparingCount.value},
  {value:'Ready' as const,label:'Ready',count:readyCount.value},
  {value:'Served' as const,label:orderStatusLabels.Served,count:outForDeliveryCount.value},
  {value:'Delivered' as const,label:orderStatusLabels.Delivered,count:deliveredCount.value},
])
const visibleOrders=computed(()=>orders.value.filter(o=>o.status===orderFilter.value))
onMounted(async()=>{
  try{const r=await $fetch<{authenticated:boolean}>('/api/admin/session');loggedIn.value=r.authenticated;if(r.authenticated)await refresh()}
  catch{error.value='Could not reach the server'}finally{checking.value=false}
})
async function refresh(){orders.value=await $fetch<Order[]>('/api/admin/orders');room.value=await $fetch<RoomState>('/api/admin/room');lastRefreshed.value=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
async function reload(){if(refreshing.value)return;refreshing.value=true;error.value='';try{await refresh()}catch(e:any){error.value=e?.data?.statusMessage||'Could not refresh the dashboard'}finally{refreshing.value=false}}
async function login(){busy.value=true;error.value='';try{await $fetch('/api/admin/login',{method:'POST',body:{password:password.value}});password.value='';loggedIn.value=true;await refresh()}catch(e:any){error.value=e?.data?.statusMessage||'Login failed'}finally{busy.value=false}}
async function logout(){await $fetch('/api/admin/logout',{method:'POST'});loggedIn.value=false;orders.value=[];success.value='';error.value='';lastRefreshed.value=''}
async function createOrder(){if(busy.value||!newOrder.value.trim())return;busy.value=true;error.value='';success.value='';try{
 await $fetch('/api/admin/orders',{method:'POST',body:{number:newOrder.value.trim()}})
 const number=newOrder.value.trim().toUpperCase();newOrder.value='';orderFilter.value='Preparing';await refresh();success.value=`${number} created and added to Preparing.`
 }catch(e:any){error.value=e?.data?.statusMessage||'Could not create order'}finally{busy.value=false}}
async function update(order:Order){
 if(updatingId.value!==null)return
 const next=orderNextStatus[order.status]
 if(!next)return
 if(next==='Delivered'){error.value='';pendingDelivery.value=order;deliveryConfirmation.value?.showModal();return}
 await applyStatus(order,next)
}
async function confirmDelivery(){
 if(!pendingDelivery.value||updatingId.value!==null)return
 await applyStatus(pendingDelivery.value,'Delivered')
 if(!error.value)deliveryConfirmation.value?.close()
}
async function applyStatus(order:Order,next:OrderStatus){
 updatingId.value=order.id;error.value='';success.value='';try{await $fetch(`/api/admin/orders/${order.id}`,{method:'PATCH',body:{status:next}});await refresh();success.value=`${order.number} marked ${orderStatusLabels[next].toLowerCase()}.`}catch(e:any){error.value=e?.data?.statusMessage||'Could not update order'}finally{updatingId.value=null}
}
async function moderate(action:string,id?:string,enabled?:boolean){
 try{room.value=await $fetch<RoomState>('/api/admin/room',{method:'POST',body:{action,id,enabled}})}catch(e:any){error.value=e?.data?.statusMessage||'Moderation failed'}
}
</script>
<template>
  <main class="admin-page" :class="{'is-authenticated':loggedIn&&!checking}">
    <div class="admin-container">
      <header class="dashboard-header">
        <div class="dashboard-heading"><span class="dashboard-brand">CHITS STORE <span>/ MERYENDA HUB</span></span><h1>Staff Dashboard</h1><p v-if="loggedIn">Manage orders and keep the conversation going.</p></div>
        <div v-if="loggedIn" class="dashboard-actions"><NuxtLink to="/" class="dashboard-store-link"><StoreGlyph name="door"/>Storefront</NuxtLink><button type="button" class="btn small secondary" :disabled="refreshing" @click="reload"><StoreGlyph name="arrow"/>{{ refreshing?'Refreshing…':'Refresh' }}</button><button class="btn small secondary logout-button" @click="logout">Log out</button></div>
      </header>
      <div v-if="checking" class="card login-card">Checking session...</div>
      <form v-else-if="!loggedIn" class="card stack login-card" @submit.prevent="login"><h2 class="section-head">Staff login</h2><label for="admin-password" class="label">Admin password</label><input id="admin-password" v-model="password" type="password" class="input" autocomplete="current-password" placeholder="Admin password"><button type="submit" class="btn full" :disabled="busy||!password">Sign in</button><p v-if="error" class="error" role="alert">{{ error }}</p><NuxtLink to="/" class="login-back">← Storefront</NuxtLink></form>
      <template v-else>
        <div v-if="error||success" class="dashboard-feedback"><p v-if="error" class="error" role="alert">{{ error }}</p><p v-else class="success" role="status">{{ success }}</p><button type="button" aria-label="Dismiss feedback" @click="error='';success=''">×</button></div>
        <section class="order-summary" aria-label="Recent order counts">
          <div class="summary-card"><span class="summary-dot preparing-dot"/><div><span class="summary-label">Preparing</span><strong>{{ preparingCount }}</strong></div><span class="summary-note">In the kitchen</span></div>
          <div class="summary-card"><span class="summary-dot ready-dot"/><div><span class="summary-label">Ready</span><strong>{{ readyCount }}</strong></div><span class="summary-note">Ready for delivery</span></div>
          <div class="summary-card"><span class="summary-dot delivery-dot"/><div><span class="summary-label">{{ orderStatusLabels.Served }}</span><strong>{{ outForDeliveryCount }}</strong></div><span class="summary-note">On the way</span></div>
          <div class="summary-card"><span class="summary-dot delivered-dot"/><div><span class="summary-label">Delivered</span><strong>{{ deliveredCount }}</strong></div><span class="summary-note">Completed orders</span></div>
        </section>
        <div class="dashboard-workspace">
          <section class="orders-column" aria-label="Order management">
            <section class="card create-order-card" aria-labelledby="create-order-heading">
              <div class="panel-heading"><h2 id="create-order-heading"><StoreGlyph name="orders"/>Create new order</h2><span class="panel-eyebrow">START HERE</span></div>
              <form class="create-order-form" @submit.prevent="createOrder"><div><label for="new-order-number" class="label">Order number</label><input id="new-order-number" v-model="newOrder" class="input" placeholder="e.g. CH-1025" maxlength="24" autocomplete="off" autocapitalize="characters"></div><button type="submit" class="btn" :disabled="busy||!newOrder.trim()">{{ busy?'Creating…':'+ Create order' }}</button></form>
              <p class="panel-help">Order numbers appear on the public board. New orders start in Preparing.</p>
            </section>
            <section class="card order-queue" aria-labelledby="order-queue-heading">
              <header class="queue-heading"><div><h2 id="order-queue-heading">Order queue</h2><p>Counts and history show your most recent 100 orders.</p></div><span v-if="lastRefreshed" class="refresh-time">Updated {{ lastRefreshed }}</span></header>
              <nav class="order-filters" aria-label="Filter orders"><button v-for="filter in filters" :key="filter.value" type="button" :aria-pressed="orderFilter===filter.value" :class="{selected:orderFilter===filter.value}" @click="orderFilter=filter.value">{{ filter.label }}<span>{{ filter.count }}</span></button></nav>
              <div class="order-table-scroll" tabindex="0" aria-label="Order queue records">
                <table v-if="visibleOrders.length" class="order-table"><caption class="visually-hidden">{{ orderStatusLabels[orderFilter] }} orders, newest first</caption><thead><tr><th scope="col">Order</th><th scope="col">Created</th><th scope="col">Status</th><th scope="col">Next step</th></tr></thead><tbody><tr v-for="order in visibleOrders" :key="order.id"><th scope="row" class="order-number">{{ order.number }}</th><td class="order-created"><time :datetime="new Date(order.createdAt).toISOString()" :title="new Date(order.createdAt).toLocaleString()"><span>{{ new Date(order.createdAt).toLocaleDateString([],{month:'short',day:'numeric'}) }}</span><span>{{ new Date(order.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) }}</span></time></td><td><span class="pill" :class="{ready:order.status==='Ready',served:order.status==='Served'||order.status==='Delivered'}">{{ orderStatusLabels[order.status] }}</span></td><td class="order-next-step"><button v-if="order.status!=='Delivered'" type="button" class="btn small" :class="{green:order.status==='Preparing',secondary:order.status==='Ready'}" :aria-label="`Mark ${order.number} ${orderStatusLabels[orderNextStatus[order.status]!].toLowerCase()}`" :disabled="updatingId!==null" @click="update(order)">{{ updatingId===order.id?'Updating…':order.status==='Preparing'?'Mark ready':order.status==='Ready'?'Send out':'Mark delivered' }}</button><span v-else class="order-dispatched"><StoreGlyph name="check"/>Delivered</span></td></tr></tbody></table>
                <div v-else class="queue-empty"><StoreGlyph name="orders"/><strong>{{ orders.length===0?'Your order queue is ready.':`No ${orderStatusLabels[orderFilter].toLowerCase()} orders.` }}</strong><p>{{ orders.length===0?'Create an order above to get started.':'Choose another status to view its orders.' }}</p></div>
              </div>
            </section>
          </section>
          <aside class="conversation-column" aria-label="Customer conversation and moderation">
            <AdminChat class="workspace-chat" @session-expired="loggedIn=false"/>
            <AdminFeedback @session-expired="loggedIn=false"/>
            <details class="card moderation-panel"><summary>Community Moderation<span>Manage visitors</span></summary><div class="moderation-content"><div class="moderation-toggle"><span>Public chat: <strong>{{ room.chatEnabled?'Enabled':'Disabled' }}</strong></span><button type="button" class="btn small secondary" @click="moderate('toggle_chat',undefined,!room.chatEnabled)">{{ room.chatEnabled?'Disable':'Enable' }}</button></div><button type="button" class="btn small secondary" :disabled="refreshing" @click="reload">Refresh visitors</button><p v-if="room.members.length===0" class="help-text">Nobody is online.</p><div v-for="visitor in room.members" :key="visitor.id" class="moderation-member"><strong>{{ visitor.nickname }}</strong><div><button type="button" class="btn small secondary" @click="moderate('mute',visitor.id)">{{ visitor.muted?'Unmute':'Mute' }}</button><button type="button" class="btn small secondary" @click="moderate('kick',visitor.id)">Kick</button></div></div><p class="privacy">Mute and kick controls are temporary and reset on restart.</p></div></details>
          </aside>
        </div>
        <dialog ref="deliveryConfirmation" class="delivery-confirmation" aria-labelledby="delivery-confirmation-heading" aria-describedby="delivery-confirmation-description" @close="pendingDelivery=null" @cancel="updatingId!==null&&$event.preventDefault()">
          <h2 id="delivery-confirmation-heading">Mark order delivered?</h2>
          <p id="delivery-confirmation-description">Confirm that <strong>{{ pendingDelivery?.number }}</strong> has reached the customer. This is the final status.</p>
          <p v-if="error" class="error" role="alert">{{ error }}</p>
          <div class="delivery-confirmation-actions"><button type="button" class="btn secondary" autofocus :disabled="updatingId!==null" @click="deliveryConfirmation?.close()">Cancel</button><button type="button" class="btn green" :disabled="updatingId!==null" @click="confirmDelivery">{{ updatingId!==null?'Updating…':'Confirm delivered' }}</button></div>
        </dialog>
      </template>
    </div>
  </main>
</template>
<style scoped src="../../assets/css/admin-dashboard.css"/>
