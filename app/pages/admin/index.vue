<script setup lang="ts">
import { orderStatusLabels,orderNextStatus,type OrderStatus } from '../../../shared/order-status'
type Order = { id:number; number:string; name:string|null; status:OrderStatus; createdAt:number }
type RoomState = { chatEnabled:boolean; members:{id:string;visitorId:number;nickname:string;muted:boolean}[] }
type StoreStatus = {open:boolean}
const loggedIn=ref(false), checking=ref(true), busy=ref(false), password=ref(''), error=ref('')
const orders=ref<Order[]>([]), room=ref<RoomState>({chatEnabled:true,members:[]})
const storeOpen=ref(true),storeActionBusy=ref(false),closeStoreConfirmation=ref<HTMLDialogElement|null>(null)
const menuManager=ref<{open:()=>void;refresh:()=>Promise<void>}|null>(null)
const resetManager=ref<{open:()=>void}|null>(null)
const chatManager=ref<{refresh:()=>Promise<void>}|null>(null),feedbackManager=ref<{refresh:()=>Promise<void>}|null>(null)
const privateInbox=ref<{refresh:()=>Promise<void>;removeOrder:(id:number)=>void}|null>(null)
let orderPoll:ReturnType<typeof setInterval>|undefined
const orderFilter=ref<OrderStatus>('Pending'),updatingId=ref<number|null>(null),refreshing=ref(false),lastRefreshed=ref(''),success=ref('')
const deliveryConfirmation=ref<HTMLDialogElement|null>(null),pendingDelivery=ref<Order|null>(null)
const pendingConfirmationDialog=ref<HTMLDialogElement|null>(null),pendingOrder=ref<Order|null>(null),pendingName=ref(''),pendingOrderError=ref('')
const deleteConfirmation=ref<HTMLDialogElement|null>(null),deleteCandidate=ref<{id:number;number:string}|null>(null),deleteError=ref('')
const createOrderDialog=ref<HTMLDialogElement|null>(null),orderName=ref(''),createOrderError=ref('')
const pendingCount=computed(()=>orders.value.filter(o=>o.status==='Pending').length)
const preparingCount=computed(()=>orders.value.filter(o=>o.status==='Preparing').length)
const readyCount=computed(()=>orders.value.filter(o=>o.status==='Ready').length)
const outForDeliveryCount=computed(()=>orders.value.filter(o=>o.status==='Served').length)
const deliveredCount=computed(()=>orders.value.filter(o=>o.status==='Delivered').length)
const filters=computed(()=>[
  {value:'Pending' as const,label:'Pending',count:pendingCount.value},
  {value:'Preparing' as const,label:'Preparing',count:preparingCount.value},
  {value:'Ready' as const,label:'Ready',count:readyCount.value},
  {value:'Served' as const,label:orderStatusLabels.Served,count:outForDeliveryCount.value},
  {value:'Delivered' as const,label:orderStatusLabels.Delivered,count:deliveredCount.value},
])
const visibleOrders=computed(()=>orders.value.filter(o=>o.status===orderFilter.value))
onMounted(async()=>{
  try{const r=await $fetch<{authenticated:boolean}>('/api/admin/session');loggedIn.value=r.authenticated;if(r.authenticated)await refresh()}
  catch{error.value='Could not reach the server'}finally{checking.value=false}
  orderPoll=setInterval(()=>{if(loggedIn.value&&!document.hidden)void $fetch<Order[]>('/api/admin/orders').then(next=>{orders.value=next}).catch(()=>{})},5000)
})
onBeforeUnmount(()=>clearInterval(orderPoll))
async function refresh(){const [nextOrders,nextRoom,nextStore]=await Promise.all([$fetch<Order[]>('/api/admin/orders'),$fetch<RoomState>('/api/admin/room'),$fetch<StoreStatus>('/api/store/status')]);orders.value=nextOrders;room.value=nextRoom;storeOpen.value=nextStore.open;lastRefreshed.value=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
async function reload(){if(refreshing.value)return;refreshing.value=true;error.value='';try{await refresh()}catch(e:any){error.value=e?.data?.statusMessage||'Could not refresh the dashboard'}finally{refreshing.value=false}}
async function login(){busy.value=true;error.value='';try{await $fetch('/api/admin/login',{method:'POST',body:{password:password.value}});password.value='';loggedIn.value=true;await refresh()}catch(e:any){error.value=e?.data?.statusMessage||'Login failed'}finally{busy.value=false}}
async function logout(){await $fetch('/api/admin/logout',{method:'POST'});loggedIn.value=false;orders.value=[];success.value='';error.value='';lastRefreshed.value=''}
function openCreateOrder(){orderName.value='';createOrderError.value='';createOrderDialog.value?.showModal()}
async function createOrder(){if(busy.value)return;busy.value=true;createOrderError.value='';error.value='';success.value='';try{
 const {order}=await $fetch<{order:Order}>('/api/admin/orders',{method:'POST',body:{name:orderName.value}})
 orderFilter.value='Preparing';createOrderDialog.value?.close()
 try{await refresh();success.value=`${order.number} created and added to Preparing.`}
 catch{error.value=`${order.number} was created, but the dashboard could not refresh. Use Refresh to see it.`}
 }catch(e:any){createOrderError.value=e?.data?.statusMessage||'Could not create order'}finally{busy.value=false}}
async function setStoreAvailability(open:boolean){
 if(storeActionBusy.value)return
 storeActionBusy.value=true;error.value='';success.value=''
 try{
   const result=await $fetch<StoreStatus>('/api/admin/store/status',{method:'POST',body:{open}})
   storeOpen.value=result.open
   if(!open)closeStoreConfirmation.value?.close()
   await refresh()
   success.value=open?'The store is open. Visitors can enter.':'The store is closed. Current visits have ended.'
 }catch(e:any){error.value=e?.data?.statusMessage||'Could not update the store'}
 finally{storeActionBusy.value=false}
}
async function update(order:Order){
 if(updatingId.value!==null)return
 const next=orderNextStatus[order.status]
 if(!next)return
 if(order.status==='Pending'){pendingOrder.value=order;pendingName.value=order.name||'';pendingOrderError.value='';pendingConfirmationDialog.value?.showModal();return}
 if(next==='Delivered'){error.value='';pendingDelivery.value=order;deliveryConfirmation.value?.showModal();return}
 await applyStatus(order,next)
}
async function updatePending(confirm:boolean){
 const order=pendingOrder.value
 if(!order||updatingId.value!==null)return
 updatingId.value=order.id;pendingOrderError.value='';error.value='';success.value=''
 try{
   await $fetch(`/api/admin/orders/${order.id}`,{method:'PATCH',body:confirm?{status:'Preparing',name:pendingName.value}:{name:pendingName.value}})
   await refresh();await privateInbox.value?.refresh()
   pendingConfirmationDialog.value?.close()
   success.value=confirm?`${order.number} confirmed and moved to Preparing.`:`${order.number} name saved.`
 }catch(e:any){pendingOrderError.value=e?.data?.statusMessage||'Could not update this order.'}
 finally{updatingId.value=null}
}
function openDeletePending(order:{id:number;number:string}){
 if(updatingId.value!==null)return
 deleteCandidate.value={id:order.id,number:order.number};deleteError.value=''
 deleteConfirmation.value?.showModal()
}
async function deletePending(){
 const order=deleteCandidate.value
 if(!order||updatingId.value!==null)return
 updatingId.value=order.id;deleteError.value='';error.value='';success.value=''
 try{
   await $fetch(`/api/admin/orders/${order.id}`,{method:'DELETE'})
   deleteConfirmation.value?.close()
   orders.value=orders.value.filter(item=>item.id!==order.id)
   privateInbox.value?.removeOrder(order.id)
   try{await Promise.all([refresh(),privateInbox.value?.refresh()]);success.value=`Pending order #${order.number} deleted.`}
   catch{error.value=`Order #${order.number} was deleted, but the dashboard could not refresh. Use Refresh to update it.`}
 }catch(e:any){deleteError.value=e?.data?.statusMessage||'Could not delete this pending order.'}
 finally{updatingId.value=null}
}
async function confirmDelivery(){
 if(!pendingDelivery.value||updatingId.value!==null)return
 await applyStatus(pendingDelivery.value,'Delivered')
 if(!error.value)deliveryConfirmation.value?.close()
}
async function applyStatus(order:Order,next:OrderStatus){
 updatingId.value=order.id;error.value='';success.value='';try{await $fetch(`/api/admin/orders/${order.id}`,{method:'PATCH',body:{status:next}});await refresh();await privateInbox.value?.refresh();success.value=order.status==='Pending'?`${order.number} confirmed and moved to Preparing.`:`${order.number} marked ${orderStatusLabels[next].toLowerCase()}.`}catch(e:any){error.value=e?.data?.statusMessage||'Could not update order'}finally{updatingId.value=null}
}
async function moderate(action:string,id?:string,enabled?:boolean){
 try{room.value=await $fetch<RoomState>('/api/admin/room',{method:'POST',body:{action,id,enabled}})}catch(e:any){error.value=e?.data?.statusMessage||'Moderation failed'}
}
async function onDataReset(options:string[]){
  error.value=''
  try{
    await refresh()
    if(options.includes('menu'))await menuManager.value?.refresh()
    if(options.includes('chat'))await chatManager.value?.refresh()
    if(options.includes('chat')||options.includes('orders'))await privateInbox.value?.refresh()
    if(options.includes('feedback'))await feedbackManager.value?.refresh()
  }catch(e:any){error.value=e?.data?.statusMessage||'Data was reset, but the dashboard could not refresh'}
  if(!error.value)success.value=`Reset complete: ${options.map(option=>({menu:"today's menu",orders:'orders',feedback:'feedback',chat:'chat',visitors:'visitor sessions'}[option]||option)).join(', ')}.`
}
</script>
<template>
  <main class="admin-page" :class="{'is-authenticated':loggedIn&&!checking}">
    <div class="admin-container">
      <header class="dashboard-header">
        <div class="dashboard-heading"><span class="dashboard-brand">CHITS STORE <span>/ MERYENDA HUB</span></span><h1>Staff Dashboard</h1><p v-if="loggedIn">Manage orders and keep the conversation going.</p></div>
        <div v-if="loggedIn" class="dashboard-actions">
          <NuxtLink to="/" class="dashboard-store-link"><StoreGlyph name="door"/>Storefront</NuxtLink>
          <button type="button" class="btn small secondary header-refresh-button" :disabled="refreshing" @click="reload"><StoreGlyph name="arrow"/>{{ refreshing?'Refreshing…':'Refresh' }}</button>
          <button type="button" class="btn small availability-button" :class="storeOpen?'secondary':'green'" :aria-label="storeOpen?'Close store (currently open)':'Open store (currently closed)'" :disabled="storeActionBusy" @click="storeOpen?closeStoreConfirmation?.showModal():setStoreAvailability(true)"><span class="store-state-dot" :class="{closed:!storeOpen}" aria-hidden="true"/>{{ storeActionBusy?'Updating…':storeOpen?'Close store':'Open store' }}</button>
          <button type="button" class="btn small secondary menu-button" @click="menuManager?.open()"><StoreGlyph name="menu"/>Today's menu</button>
          <button type="button" class="btn small secondary reset-data-button" @click="resetManager?.open()">Reset data</button>
          <button type="button" class="btn small secondary logout-button" @click="logout">Log out</button>
        </div>
      </header>
      <div v-if="checking" class="card login-card">Checking session...</div>
      <form v-else-if="!loggedIn" class="card stack login-card" @submit.prevent="login"><h2 class="section-head">Staff login</h2><label for="admin-password" class="label">Admin password</label><input id="admin-password" v-model="password" type="password" class="input" autocomplete="current-password" placeholder="Admin password"><button type="submit" class="btn full" :disabled="busy||!password">Sign in</button><p v-if="error" class="error" role="alert">{{ error }}</p><NuxtLink to="/" class="login-back">← Storefront</NuxtLink></form>
      <template v-else>
        <div v-if="error||success" class="dashboard-feedback"><p v-if="error" class="error" role="alert">{{ error }}</p><p v-else class="success" role="status">{{ success }}</p><button type="button" aria-label="Dismiss feedback" @click="error='';success=''">×</button></div>
        <AdminDailyMenu ref="menuManager" @session-expired="loggedIn=false"/>
        <AdminResetData ref="resetManager" @reset="onDataReset" @session-expired="loggedIn=false"/>
        <section class="order-summary" aria-label="Recent order counts">
          <div class="summary-card"><span class="summary-dot pending-dot"/><div><span class="summary-label">Pending</span><strong>{{ pendingCount }}</strong></div><span class="summary-note">Needs confirmation</span></div>
          <div class="summary-card"><span class="summary-dot preparing-dot"/><div><span class="summary-label">Preparing</span><strong>{{ preparingCount }}</strong></div><span class="summary-note">In the kitchen</span></div>
          <div class="summary-card"><span class="summary-dot ready-dot"/><div><span class="summary-label">Ready</span><strong>{{ readyCount }}</strong></div><span class="summary-note">Ready for delivery</span></div>
          <div class="summary-card"><span class="summary-dot delivery-dot"/><div><span class="summary-label">{{ orderStatusLabels.Served }}</span><strong>{{ outForDeliveryCount }}</strong></div><span class="summary-note">On the way</span></div>
          <div class="summary-card"><span class="summary-dot delivered-dot"/><div><span class="summary-label">Delivered</span><strong>{{ deliveredCount }}</strong></div><span class="summary-note">Completed orders</span></div>
        </section>
        <div class="dashboard-workspace">
          <section class="orders-column" aria-label="Order management">
            <section class="card order-queue" aria-labelledby="order-queue-heading">
              <header class="queue-heading"><div><h2 id="order-queue-heading">Order queue</h2><p>Counts and history show your most recent 100 orders.</p><span v-if="lastRefreshed" class="refresh-time">Updated {{ lastRefreshed }}</span></div><button type="button" class="btn queue-create-button" :disabled="busy" @click="openCreateOrder">+ Create order</button></header>
              <nav class="order-filters" aria-label="Filter orders"><button v-for="filter in filters" :key="filter.value" type="button" :aria-pressed="orderFilter===filter.value" :class="{selected:orderFilter===filter.value}" @click="orderFilter=filter.value">{{ filter.label }}<span>{{ filter.count }}</span></button></nav>
              <div class="order-table-scroll" tabindex="0" aria-label="Order queue records">
                <table v-if="visibleOrders.length" class="order-table"><caption class="visually-hidden">{{ orderStatusLabels[orderFilter] }} orders, newest first</caption><thead><tr><th scope="col">Order</th><th scope="col">Created</th><th scope="col">Status</th><th scope="col">Next step</th></tr></thead><tbody><tr v-for="order in visibleOrders" :key="order.id"><th scope="row" class="order-number"><span>{{ order.number }}</span><small v-if="order.name" class="order-customer-name">{{ order.name }}</small></th><td class="order-created"><time :datetime="new Date(order.createdAt).toISOString()" :title="new Date(order.createdAt).toLocaleString()"><span>{{ new Date(order.createdAt).toLocaleDateString([],{month:'short',day:'numeric'}) }}</span><span>{{ new Date(order.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) }}</span></time></td><td><span class="pill" :class="{ready:order.status==='Ready',served:order.status==='Served'||order.status==='Delivered'}">{{ orderStatusLabels[order.status] }}</span></td><td class="order-next-step"><div v-if="order.status!=='Delivered'" class="order-row-actions"><button type="button" class="btn small" :class="{green:order.status==='Pending'||order.status==='Preparing',secondary:order.status==='Ready'}" :aria-label="order.status==='Pending'?`Confirm order ${order.number}`:`Mark ${order.number} ${orderStatusLabels[orderNextStatus[order.status]!].toLowerCase()}`" :disabled="updatingId!==null" @click="update(order)">{{ updatingId===order.id?'Updating…':order.status==='Pending'?'Confirm order':order.status==='Preparing'?'Mark ready':order.status==='Ready'?'Send out':'Mark delivered' }}</button><button v-if="order.status==='Pending'" type="button" class="btn small secondary pending-delete" :aria-label="`Delete pending order ${order.number}`" :disabled="updatingId!==null" @click="openDeletePending(order)">Delete</button></div><span v-else class="order-dispatched"><StoreGlyph name="check"/>Delivered</span></td></tr></tbody></table>
                <div v-else class="queue-empty"><StoreGlyph name="orders"/><strong>{{ orders.length===0?'Your order queue is ready.':`No ${orderStatusLabels[orderFilter].toLowerCase()} orders.` }}</strong><p>{{ orders.length===0?'Create an order above to get started.':'Choose another status to view its orders.' }}</p></div>
              </div>
            </section>
          </section>
          <aside class="conversation-column" aria-label="Customer conversation and moderation">
            <AdminOrderInbox ref="privateInbox" :store-open="storeOpen" @order-updated="reload" @delete-pending="openDeletePending" @session-expired="loggedIn=false"/>
            <AdminChat ref="chatManager" class="workspace-chat" :store-open="storeOpen" @session-expired="loggedIn=false"/>
            <AdminFeedback ref="feedbackManager" @session-expired="loggedIn=false"/>
            <AdminJukebox @session-expired="loggedIn=false"/>
            <details class="card moderation-panel"><summary>Community Moderation<span>Manage visitors</span></summary><div class="moderation-content"><div class="moderation-toggle"><span>Public chat: <strong>{{ room.chatEnabled?'Enabled':'Disabled' }}</strong></span><button type="button" class="btn small secondary" @click="moderate('toggle_chat',undefined,!room.chatEnabled)">{{ room.chatEnabled?'Disable':'Enable' }}</button></div><button type="button" class="btn small secondary" :disabled="refreshing" @click="reload">Refresh visitors</button><p v-if="room.members.length===0" class="help-text">Nobody is online.</p><div v-for="visitor in room.members" :key="visitor.id" class="moderation-member"><strong>{{ visitor.nickname }}</strong><div><button type="button" class="btn small secondary" @click="moderate('mute',visitor.id)">{{ visitor.muted?'Unmute':'Mute' }}</button><button type="button" class="btn small secondary" @click="moderate('kick',visitor.id)">Kick</button></div></div><p class="privacy">Mute and kick controls are temporary and reset on restart.</p></div></details>
          </aside>
        </div>
        <dialog ref="createOrderDialog" class="delivery-confirmation create-order-modal" aria-labelledby="create-order-heading" @close="orderName='';createOrderError=''" @cancel="busy&&$event.preventDefault()">
          <form @submit.prevent="createOrder">
            <h2 id="create-order-heading">Create order</h2>
            <p>We’ll assign the next order number automatically. A name added here appears on the public live orders board.</p>
            <label for="create-order-name" class="label">Name <span>(optional)</span></label>
            <input id="create-order-name" v-model="orderName" class="input" type="text" maxlength="60" autocomplete="off" placeholder="Customer name" autofocus :disabled="busy">
            <p v-if="createOrderError" class="error" role="alert">{{ createOrderError }}</p>
            <div class="delivery-confirmation-actions"><button type="button" class="btn secondary" :disabled="busy" @click="createOrderDialog?.close()">Cancel</button><button type="submit" class="btn" :disabled="busy">{{ busy?'Creating…':'Create order' }}</button></div>
          </form>
        </dialog>
        <dialog ref="pendingConfirmationDialog" class="delivery-confirmation create-order-modal" aria-labelledby="pending-confirmation-heading" @close="pendingOrder=null;pendingName='';pendingOrderError=''" @cancel="updatingId!==null&&$event.preventDefault()">
          <form @submit.prevent="updatePending(true)">
            <h2 id="pending-confirmation-heading">Pending order #{{ pendingOrder?.number }}</h2>
            <p>Add a name if helpful. It appears on the live order board after confirmation.</p>
            <label for="pending-order-name" class="label">Order name <span>(optional)</span></label>
            <input id="pending-order-name" v-model="pendingName" class="input" type="text" maxlength="60" autocomplete="off" placeholder="Customer name" :disabled="updatingId!==null">
            <p v-if="pendingOrderError" class="error" role="alert">{{ pendingOrderError }}</p>
            <div class="delivery-confirmation-actions"><button type="button" class="btn secondary" :disabled="updatingId!==null" @click="pendingConfirmationDialog?.close()">Cancel</button><button type="button" class="btn secondary" :disabled="updatingId!==null" @click="updatePending(false)">Save name</button><button type="submit" class="btn green" :disabled="updatingId!==null">{{ updatingId!==null?'Saving…':'Confirm order' }}</button></div>
          </form>
        </dialog>
        <dialog ref="deleteConfirmation" class="delivery-confirmation" aria-labelledby="delete-pending-heading" aria-describedby="delete-pending-description" @close="deleteCandidate=null;deleteError=''" @cancel="updatingId!==null&&$event.preventDefault()">
          <h2 id="delete-pending-heading">Delete pending order?</h2>
          <p id="delete-pending-description">Order <strong>#{{ deleteCandidate?.number }}</strong> and its private messages will be removed from the staff and customer inboxes. This cannot be undone.</p>
          <p v-if="deleteError" class="error" role="alert">{{ deleteError }}</p>
          <div class="delivery-confirmation-actions"><button type="button" class="btn secondary" autofocus :disabled="updatingId!==null" @click="deleteConfirmation?.close()">Keep order</button><button type="button" class="btn pending-delete-confirm" :disabled="updatingId!==null" @click="deletePending">{{ updatingId!==null?'Deleting…':'Delete pending order' }}</button></div>
        </dialog>
        <dialog ref="closeStoreConfirmation" class="delivery-confirmation" aria-labelledby="close-store-heading" aria-describedby="close-store-description" @cancel="storeActionBusy&&$event.preventDefault()">
          <h2 id="close-store-heading">Close the store?</h2>
          <p id="close-store-description">New visitors will not be able to enter. {{ room.members.length ? `The ${room.members.length} visitor${room.members.length===1?'':'s'} currently inside will be disconnected.`:'Anyone already inside will be disconnected.' }} You can reopen the store anytime.</p>
          <div class="delivery-confirmation-actions"><button type="button" class="btn secondary" autofocus :disabled="storeActionBusy" @click="closeStoreConfirmation?.close()">Cancel</button><button type="button" class="btn" :disabled="storeActionBusy" @click="setStoreAvailability(false)">{{ storeActionBusy?'Closing…':'Close store' }}</button></div>
        </dialog>
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
<style scoped src="../../assets/css/admin-pixel.css"/>
