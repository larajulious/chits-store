<script setup lang="ts">
type Order = { id:number; number:string; status:'Preparing'|'Ready'|'Served'; createdAt:number }
type RoomState = { chatEnabled:boolean; members:{id:string;visitorId:number;nickname:string;muted:boolean}[] }
const loggedIn=ref(false), checking=ref(true), busy=ref(false), password=ref(''), error=ref(''), newOrder=ref('')
const orders=ref<Order[]>([]), room=ref<RoomState>({chatEnabled:true,members:[]})
const totalActive=computed(()=>orders.value.filter(o=>o.status!=='Served').length)
onMounted(async()=>{
  try{const r=await $fetch<{authenticated:boolean}>('/api/admin/session');loggedIn.value=r.authenticated;if(r.authenticated)await refresh()}
  catch{error.value='Could not reach the server'}finally{checking.value=false}
})
async function refresh(){orders.value=await $fetch<Order[]>('/api/admin/orders');room.value=await $fetch<RoomState>('/api/admin/room')}
async function login(){busy.value=true;error.value='';try{await $fetch('/api/admin/login',{method:'POST',body:{password:password.value}});password.value='';loggedIn.value=true;await refresh()}catch(e:any){error.value=e?.data?.statusMessage||'Login failed'}finally{busy.value=false}}
async function logout(){await $fetch('/api/admin/logout',{method:'POST'});loggedIn.value=false;orders.value=[]}
async function createOrder(){busy.value=true;error.value='';try{
 await $fetch('/api/admin/orders',{method:'POST',body:{number:newOrder.value.trim()}})
 newOrder.value='';await refresh()
 }catch(e:any){error.value=e?.data?.statusMessage||'Could not create order'}finally{busy.value=false}}
async function update(order:Order){
 const next=order.status==='Preparing'?'Ready':order.status==='Ready'?'Served':null
 if(!next)return
 if(next==='Served'&&!confirm(`Mark ${order.number} served? This is final.`))return
 error.value='';try{await $fetch(`/api/admin/orders/${order.id}`,{method:'PATCH',body:{status:next}});await refresh()}catch(e:any){error.value=e?.data?.statusMessage||'Could not update order'}
}
async function moderate(action:string,id?:string,enabled?:boolean){
 try{room.value=await $fetch<RoomState>('/api/admin/room',{method:'POST',body:{action,id,enabled}})}catch(e:any){error.value=e?.data?.statusMessage||'Moderation failed'}
}
</script>
<template><main class="page" style="justify-content:flex-start"><div class="shell stack">
  <div class="row between" style="padding:10px 0"><div><div class="label">CHITS STORE</div><h1 class="title" style="font-size:1.8rem;margin:0">Staff Dashboard</h1></div><button v-if="loggedIn" class="btn small secondary" @click="logout">Log out</button></div>
  <div v-if="checking" class="card">Checking session...</div>
  <template v-else-if="!loggedIn"><div class="card stack"><h2 class="section-head">Staff login</h2><label class="label">Admin password</label><input v-model="password" type="password" class="input" autocomplete="current-password" @keyup.enter="login" placeholder="Admin password"><button class="btn full" :disabled="busy||!password" @click="login">Sign in</button><p v-if="error" class="error">{{ error }}</p></div></template>
  <template v-else>
    <div class="card stack"><div class="row between"><h2 class="section-head" style="margin:0">Create new order</h2><span class="pill">{{ totalActive }} active</span></div>
      <label class="label">Order number</label><input v-model="newOrder" class="input" placeholder="CH-1025" maxlength="24" @keyup.enter="createOrder">
      <button class="btn full" :disabled="busy||!newOrder.trim()" @click="createOrder">+ Create Order</button>
      <p class="help-text">All visitors can enter the public store. Just share your main store URL; no individual links required.</p>
      <p v-if="error" class="error">{{ error }}</p>
    </div>
    <div class="card"><div class="row between" style="margin-bottom:12px"><h2 class="section-head" style="margin:0">Recent orders</h2><button class="btn small secondary" @click="refresh">Refresh</button></div>
      <div v-if="orders.length===0" class="muted">No orders yet. Create one above.</div>
      <div v-for="o in orders" :key="o.id" class="order-row row between"><div><strong>{{ o.number }}</strong><div class="help-text">{{ new Date(o.createdAt).toLocaleString() }}</div></div><div class="stack" style="justify-items:end;gap:5px"><span class="pill" :class="{ready:o.status==='Ready',served:o.status==='Served'}">{{ o.status }}</span><button v-if="o.status!=='Served'" class="btn small" @click="update(o)">→ {{ o.status==='Preparing'?'Ready':'Served' }}</button></div></div>
    </div>
    <details class="card stack"><summary style="cursor:pointer;font-weight:900">Community Moderation · {{ room.members.length }} online</summary>
      <div class="stack" style="margin-top:12px"><div class="row between"><span>Public chat: <strong>{{ room.chatEnabled?'Enabled':'Disabled' }}</strong></span><button class="btn small secondary" @click="moderate('toggle_chat',undefined,!room.chatEnabled)">{{ room.chatEnabled?'Disable':'Enable' }}</button></div>
        <button class="btn small secondary" @click="refresh">Refresh visitors</button>
        <p v-if="room.members.length===0" class="help-text">Nobody is online.</p>
        <div v-for="p in room.members" :key="p.id" class="order-row row between"><strong>{{ p.nickname }}</strong><div class="row"><button class="btn small secondary" @click="moderate('mute',p.id)">{{ p.muted?'Unmute':'Mute' }}</button><button class="btn small secondary" @click="moderate('kick',p.id)">Kick</button></div></div>
        <p class="privacy">Mute and kick controls are temporary (stored in server memory). For a public launch, add persistent bans and reporting.</p>
      </div>
    </details>
  </template>
  <NuxtLink to="/" class="footer-link">← Storefront</NuxtLink>
</div></main></template>
