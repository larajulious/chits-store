<script setup lang="ts">
import type { Player } from '../../game/createGame'
import { isAvatar } from '../../shared/avatars'
import { reactionOptions } from '../../shared/reactions'
import { orderStatusLabels,type OrderStatus } from '../../shared/order-status'
import type { ChatMessage } from '../../shared/chat'
const route=useRoute()
const featureConfig=useRuntimeConfig().public
// Runtime flags can disable a feature for everyone; query switches isolate one browser for profiling.
const catEnabled=computed(()=>String(featureConfig.storeCatEnabled)!=='false'&&route.query.cat!=='0')
const guideEnabled=computed(()=>String(featureConfig.storeGuideEnabled)!=='false'&&route.query.guide!=='0')
type Status = OrderStatus
type PublicOrder = { id:number; number:string; status:Status }
type MenuState = { date:string; version:string; items:{id:number;name:string;priceCentavos:number}[] }
type Me = { nickname:string; avatar:string }
const me=ref<Me|null>(null), board=ref<PublicOrder[]>([]), players=ref<Player[]>([]), selfId=ref('')
const menu=ref<MenuState>({date:'',version:'',items:[]}),menuLoading=ref(false),menuError=ref('')
let menuStale=true,menuEpoch=0,wantedMenuVersion:string|null=null,hasWelcomed=false,hiddenAt=0
let menuReloadAfterCurrent=false
const menuDate=computed(()=>menu.value.date===manilaDate()?new Date(`${menu.value.date}T12:00:00`).toLocaleDateString('en-PH',{month:'long',day:'numeric'}):'today')
const hasCurrentMenu=computed(()=>Boolean(menu.value.version&&menu.value.date===manilaDate()))
const visitorAvatar=computed(()=>isAvatar(me.value?.avatar)?me.value.avatar:'mochi')
const online=computed(()=>players.value.length)
const overlay=ref(''), message=ref(''), chat=ref<ChatMessage[]>([]), notice=ref(''), connected=ref(false), returningHome=ref(false), chatEnabled=ref(true)
const game=ref<{showBubble:(id:string,text:string)=>void;showStaffBubble:(text:string)=>void;movePlayer:(id:string,x:number,y:number)=>void;tossYarn:()=>boolean|undefined;petCat:()=> 'petted'|'too_far'|'busy'|undefined}|null>(null)
const leaveDialog=ref<{open:()=>void;close:()=>void}|null>(null),leaving=ref(false)
const visitThanks=useState<boolean>('visit-thanks',()=>false)
const feedbackBox=ref<{refresh:()=>Promise<void>}|null>(null)
let socket:WebSocket|null=null, alive=true, reconnect:ReturnType<typeof setTimeout>|undefined, heartbeat:ReturnType<typeof setInterval>|undefined,boardRefresh:ReturnType<typeof setInterval>|undefined,menuDayTimer:ReturnType<typeof setTimeout>|undefined
const preparing=computed(()=>board.value.filter(o=>o.status==='Preparing').length)
const ready=computed(()=>board.value.filter(o=>o.status==='Ready').length)
const headerTime=computed(()=>new Date().getHours()<12?'Good morning!':new Date().getHours()<18?'Good afternoon!':'Good evening!')
const statusOptions:Status[]=['Preparing','Ready','Served','Delivered']
onMounted(async()=>{
  document.addEventListener('visibilitychange',onVisibilityChanged)
  scheduleNextMenuDay()
  try { me.value=await $fetch<Me>('/api/me');void loadMenu();await loadBoard();if(alive){connect();boardRefresh=setInterval(()=>void loadBoard(),30_000)} }
  catch { void returnHome() }
})
onBeforeUnmount(()=>{alive=false;document.removeEventListener('visibilitychange',onVisibilityChanged);clearTimeout(reconnect);clearInterval(heartbeat);clearInterval(boardRefresh);clearTimeout(menuDayTimer);socket?.close()})
async function loadBoard(){try{board.value=await $fetch<PublicOrder[]>('/api/orders/board')}catch{}}
function manilaDate(){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date())
  const value=(type:string)=>parts.find(part=>part.type===type)?.value
  return `${value('year')}-${value('month')}-${value('day')}`
}
function scheduleNextMenuDay(){
  clearTimeout(menuDayTimer)
  const [year,month,day]=manilaDate().split('-').map(Number) as [number,number,number]
  const next=Date.UTC(year,month-1,day+1)-8*60*60_000+1000
  menuDayTimer=setTimeout(()=>{
    menuStale=true;menuEpoch++
    if(!document.hidden)void loadMenu(true)
    scheduleNextMenuDay()
  },Math.max(1000,next-Date.now()))
}
async function loadMenu(force=false){
  if(!alive||returningHome.value)return
  if(!force&&!menuStale&&menu.value.version&&menu.value.date===manilaDate())return
  if(menuLoading.value){if(force)menuReloadAfterCurrent=true;return}
  const startedAtEpoch=menuEpoch
  menuLoading.value=true;menuError.value=''
  try{
    const current=await $fetch<MenuState>('/api/menu/today')
    if(!alive)return
    menu.value=current
    menuStale=(startedAtEpoch!==menuEpoch&&(!wantedMenuVersion||current.version!==wantedMenuVersion))||current.date!==manilaDate()
    if(!menuStale)wantedMenuVersion=null
  }catch{menuStale=true;menuError.value='Could not load today’s menu. Please try again.'}
  finally{
    menuLoading.value=false
    if(menuReloadAfterCurrent){menuReloadAfterCurrent=false;if(menuStale&&alive&&!document.hidden)void loadMenu(true)}
  }
}
function onMenuUpdated(version:unknown){
  const next=typeof version==='string'?version:null
  if(next&&(next===menu.value.version||next===wantedMenuVersion))return
  wantedMenuVersion=next;menuStale=true;menuEpoch++
  if(overlay.value==='menu'&&!document.hidden)void loadMenu(true)
}
function onVisibilityChanged(){
  if(document.hidden){hiddenAt=Date.now();return}
  if(menuStale||menu.value.date!==manilaDate()||(hiddenAt&&Date.now()-hiddenAt>5000)){
    menuStale=true;menuEpoch++;void loadMenu(true)
  }
  hiddenAt=0
}
async function returnHome(){
  if(!alive||returningHome.value)return
  returningHome.value=true
  clearTimeout(reconnect);clearInterval(heartbeat);clearInterval(boardRefresh);clearTimeout(menuDayTimer)
  const current=socket;socket=null;current?.close()
  try{const result=await navigateTo('/',{replace:true});if(result===false)window.location.replace('/')}
  catch{window.location.replace('/')}
}
function connect(){
  if(!alive||returningHome.value)return
  const current=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`)
  socket=current
  current.onopen=()=>{clearInterval(heartbeat);heartbeat=setInterval(()=>send({type:'ping'}),20_000)}
  current.onmessage=async evt=>{
    if(returningHome.value)return
    let data:any; try{data=JSON.parse(evt.data)}catch{return}
    if(data.type==='welcome'){
      connected.value=true;selfId.value=data.selfId;players.value=data.players||[];chatEnabled.value=data.chatEnabled!==false
      if(hasWelcomed){menuStale=true;menuEpoch++;if(!document.hidden)void loadMenu(true)}
      hasWelcomed=true
      await loadBoard()
    }
    if(data.type==='players')players.value=data.players||[]
    if(data.type==='player_moved'){
      const found=players.value.find(p=>p.id===data.id)
      if(found&&found.id!==selfId.value&&Number.isFinite(data.x)&&Number.isFinite(data.y)){
        Object.assign(toRaw(found),{x:data.x,y:data.y})
        game.value?.movePlayer(data.id,data.x,data.y)
      }
    }
    if(data.type==='chat'){
      const entry:ChatMessage={messageId:data.messageId,id:data.id,nickname:data.nickname,text:data.text,at:data.at,role:data.role==='staff'?'staff':'visitor'}
      chat.value=[...chat.value.slice(-49),entry]
      if(entry.role==='staff')game.value?.showStaffBubble(entry.text)
      else game.value?.showBubble(entry.id,entry.text)
    }
    if(data.type==='chat_reset')chat.value=[]
    if(data.type==='emote')game.value?.showBubble(data.id,data.emoji)
    if(data.type==='feedback_changed')void feedbackBox.value?.refresh()
    if(data.type==='menu:updated'||data.type==='menu_changed')onMenuUpdated(data.version)
    if(data.type==='order_changed'){
      await loadBoard()
      if(data.order?.status==='Ready') notice.value=`🔔 ${data.order.number} is ready!`
      if(data.order?.status==='Served') notice.value=`🍡 ${data.order.number} is out for delivery.`
      if(data.order?.status==='Delivered') notice.value=`✓ ${data.order.number} has been delivered. Thank you!`
    }
    if(data.type==='chat_enabled'){chatEnabled.value=data.enabled}
    if(data.type==='chat_blocked')notice.value='Chat is unavailable right now.'
    if(data.type==='chat_slow_down')notice.value='Please slow down your messages.'
    if(['room_full','kicked','store_closed','choose_avatar','replaced'].includes(data.type))void returnHome()
  }
  current.onclose=async evt=>{
    if(socket!==current||returningHome.value)return
    connected.value=false;players.value=[];clearInterval(heartbeat)
    if(evt.code===1008){void returnHome();return}
    if(!alive)return
    try{me.value=await $fetch<Me>('/api/me')}catch(e:any){if(e?.response?.status===401||e?.response?.status===503){void returnHome();return}}
    if(alive&&!returningHome.value)reconnect=setTimeout(connect,2500)
  }
  current.onerror=()=>{connected.value=false}
}
function send(data:object){if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(data))}
function sendChat(){const text=message.value.trim();if(!connected.value||!text||text.length>160||!chatEnabled.value)return;send({type:'chat',text});message.value=''}
function interact(kind:string){overlay.value=kind;if(kind==='menu')void loadMenu()}
function petCat(){if(game.value?.petCat()==='too_far')notice.value='Walk closer to Miming to pet the cat.'}
async function leave(){
  if(leaving.value)return
  leaving.value=true;visitThanks.value=true
  try{await navigateTo('/')}
  catch{visitThanks.value=false;leaving.value=false;leaveDialog.value?.close();notice.value='Could not leave right now. Please try again.'}
}
</script>
<template><main class="game-shell structured-store">
  <header class="structured-store-top">
    <div class="visitor-identity"><span class="visitor-portrait"><AvatarIcon :avatar="visitorAvatar"/></span><div><strong>CHITS STORE</strong><span>{{ me?.nickname || 'Public bakery' }}</span></div></div>
    <div class="visit-status"><span class="pill" :class="{ready:connected}">{{ connected?'● Connected':'○ Connecting' }}</span><span class="visitor-count"><StoreGlyph name="people"/>{{ online }} online</span></div>
  </header>
  <template v-if="me&&!returningHome">
    <div v-if="notice" class="row between structured-notice" style="padding:10px;background:#e7f3d4"><strong style="font-size:.85rem">{{ notice }}</strong><button class="btn small secondary" aria-label="Dismiss notice" @click="notice=''">✕</button></div>
    <div class="bakery-status-strip"><span>INSIDE THE MERYENDA HUB</span><div><span>{{ preparing }} preparing</span><span class="ready-count">{{ ready }} ready</span></div></div>
    <div class="game-stage">
      <ClientOnly><GameCanvas :key="`${catEnabled}-${guideEnabled}`" ref="game" :nickname="me.nickname" :avatar="me.avatar" :players="players" :self-id="selfId" :board="board" :cat-enabled="catEnabled" :guide-enabled="guideEnabled" :controls-enabled="!overlay&&!leaving" @move="p=>send({type:'move',x:p.x,y:p.y})" @interact="interact" @cat-hint="notice='Walk closer to Miming to pet the cat.'"/></ClientOnly>
    </div>
    <nav class="structured-actions" aria-label="Store actions">
      <button type="button" @click="overlay='chat'"><StoreGlyph name="chat"/><span>Chat</span></button>
      <button type="button" @click="interact('menu')"><StoreGlyph name="menu"/><span>Menu</span></button>
      <button type="button" @click="overlay='board'"><StoreGlyph name="orders"/><span>Orders</span></button>
      <button type="button" @click="overlay='emotes'"><StoreGlyph name="smile"/><span>Emotes</span></button>
      <button type="button" @click="overlay='feedback'"><StoreGlyph name="feedback"/><span>Feedback</span></button>
      <button type="button" @click="leaveDialog?.open()"><StoreGlyph name="door"/><span>Leave</span></button>
    </nav>
    <div v-if="catEnabled" class="help-text structured-hint" style="background:#fff7e8;text-align:center;padding-bottom:9px"><span>Drag yarn · tap Miming to pet</span><button type="button" class="yarn-toss" :disabled="!!overlay" @click="petCat">Pet cat</button><button type="button" class="yarn-toss" aria-label="Toss yarn for Miming the shop cat" :disabled="!!overlay" @click="game?.tossYarn()">Toss yarn</button></div>
    <div v-if="overlay" class="overlay-shade" @click.self="overlay=''">
      <section class="overlay-panel stack store-dialog" :class="{'feedback-dialog':overlay==='feedback'}" role="dialog" aria-labelledby="store-dialog-title">
        <header class="dialog-header"><h2 id="store-dialog-title" class="section-head">{{ {chat:'Community Chat',menu:"Today's Menu",board:'Live Order Board',cashier:'Cashier',chef:'Chef',seat:'Take a Seat',emotes:'Reactions',feedback:'Feedback box'}[overlay]||overlay }}</h2><button type="button" class="btn secondary dialog-close" aria-label="Close dialog" @click="overlay=''"><span aria-hidden="true">×</span></button></header>
        <FeedbackBox v-if="overlay==='feedback'" ref="feedbackBox"/>
        <template v-if="overlay==='menu'">
          <p class="menu-greeting">🍡 Hi, {{ me.nickname }}! Here’s the meryenda for {{ menuDate }}.</p>
          <p v-if="!hasCurrentMenu&&menuLoading" class="menu-message">Checking today’s menu…</p>
          <p v-else-if="!hasCurrentMenu&&menuError" class="menu-message" role="alert">{{ menuError }}</p>
          <p v-else-if="!hasCurrentMenu||!menu.items.length" class="menu-message">Today’s menu hasn’t been posted yet. Please check back soon!</p>
          <ul v-else class="visitor-menu"><li v-for="item in menu.items" :key="item.id"><span>{{ item.name }}</span><strong>₱{{ (item.priceCentavos/100).toFixed(2) }}</strong></li></ul>
          <p v-if="hasCurrentMenu&&menuLoading" class="menu-message">Updating today’s menu…</p>
          <p v-if="hasCurrentMenu&&menuError" class="menu-message" role="alert">{{ menuError }}</p>
          <button type="button" class="btn small secondary dialog-action" :disabled="menuLoading" @click="loadMenu(true)">Refresh menu</button>
        </template>
        <template v-if="overlay==='board'">
          <section class="order-status-group" v-for="status in statusOptions" :key="status" :aria-label="`${orderStatusLabels[status]} orders`"><div class="order-status-heading"><strong>{{ orderStatusLabels[status] }}</strong><span>{{ board.filter(o=>o.status===status).length }}</span></div><div class="order-chips"><span v-for="o in board.filter(b=>b.status===status)" :key="o.id" class="pill" :class="{ready:status==='Ready',served:status==='Served'||status==='Delivered'}">{{ o.number }}</span><small v-if="!board.some(o=>o.status===status)" class="muted">No orders</small></div></section>
          <p class="privacy">Only order numbers and statuses are public. If you have questions about your order, contact the store through Messenger.</p>
          <button class="btn small secondary dialog-action" @click="loadBoard">Refresh board</button>
        </template>
        <template v-else-if="overlay==='cashier'"><p>🍮 {{ headerTime }} Welcome to Chits Store, {{ me.nickname }}!</p><p>{{ preparing }} order(s) preparing · {{ ready }} ready. You can check the live board anytime.</p><button class="btn small dialog-action" @click="overlay='board'">View orders</button><p class="help-text">Tap anywhere on the floor or use the joystick to move. Tap the chef or order board to interact.</p></template>
        <template v-else-if="overlay==='chef'"><p>👨‍🍳 🍡 {{ preparing ? 'Stirring up tasty orders right now!' : 'Trying a fresh batch of meryenda!' }}</p><p class="help-text">Only staff can change real order statuses.</p></template>
        <template v-else-if="overlay==='seat'"><p>☕ Make yourself comfortable! Say hi to everyone while you wait.</p><button class="btn small dialog-action" @click="overlay='chat'">Join conversation</button></template>
        <template v-else-if="overlay==='emotes'"><div class="reaction-grid"><button v-for="reaction in reactionOptions" :key="reaction.emoji" type="button" class="btn secondary reaction-choice" @click="send({type:'emote',emoji:reaction.emoji});overlay=''"><PixelReaction class="reaction-symbol" :emoji="reaction.emoji"/><span>{{ reaction.label }}</span></button></div></template>
        <template v-else-if="overlay==='chat'"><div class="chat-messages" aria-live="polite"><div v-if="chat.length===0" class="muted help-text chat-empty">Say hello! Chat messages are temporary.</div><div v-for="c in chat" :key="c.messageId" class="chat-line"><span v-if="c.role==='staff'" class="chat-staff-tag">STAFF</span><strong>{{ c.nickname }}:</strong> {{ c.text }}</div></div><form class="chat-form" @submit.prevent="sendChat"><input v-model="message" class="input" maxlength="160" aria-label="Chat message" placeholder="Say hi..." autocomplete="off"><button class="btn small" type="submit" :disabled="!connected||!message.trim()||!chatEnabled">Send</button></form><p v-if="!chatEnabled" class="privacy">Chat is temporarily disabled by staff.</p><p class="privacy">Public room: do not share personal details. Staff can mute or remove visitors. Chat is not permanently stored.</p></template>
      </section>
    </div>
  </template>
  <div v-else class="page">{{ returningHome?'Returning to welcome...':'Opening the bakery...' }}</div>
  <VisitDialog ref="leaveDialog" variant="leave" :busy="leaving" @confirm="leave"/>
</main></template>
<style scoped>
.structured-store{width:min(100%,480px);height:calc(100dvh - 48px);min-height:640px;max-height:960px;margin:24px auto;overflow:hidden;border:1px solid #d8c6ad;border-radius:22px;background:#fffaf1;box-shadow:0 12px 36px #64442d12}
.structured-store-top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;background:#fffaf1;border-bottom:1px solid #e7dac8;flex-shrink:0}
.visitor-identity{display:flex;align-items:center;gap:10px;min-width:0}.visitor-portrait{width:42px;height:42px;border:1px solid #e5d8c0;border-radius:12px;background:#efe4d0;display:grid;place-items:center;flex-shrink:0}.visitor-portrait :deep(.avatar-symbol){transform:scale(.78)}.visitor-identity strong{display:block;font-size:12px;letter-spacing:.12em;color:#523b2a}.visitor-identity div>span{display:block;margin-top:5px;font-size:11px;color:#9b8065;overflow-wrap:anywhere}.visit-status{display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0}.visit-status .pill{padding:4px 8px;font-size:10px}.visitor-count{display:flex;align-items:center;gap:5px;font-size:10px;color:#8f795e}.visitor-count svg{width:13px;height:13px}
.bakery-status-strip{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-shrink:0;padding:11px 18px;background:#f5ecdd;border-bottom:1px solid #d8c09e}.bakery-status-strip>span{color:#9c7f5a;font-size:9px;letter-spacing:.1em;font-weight:800}.bakery-status-strip>div{display:flex;gap:12px;color:#9a7554;font-size:10px}.bakery-status-strip .ready-count{color:#647d52;font-weight:700}
.structured-store .game-stage{flex:1;min-height:0;background:#dab080}.structured-actions{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px;padding:12px 14px 10px;background:#fffaf1;border-top:1px solid #e1ccb0;flex-shrink:0}.structured-actions button,.structured-actions a{min-width:0;min-height:59px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:#f7efe1;border:1px solid #e6d7c0;border-radius:12px;color:#86694a;text-decoration:none;font-size:10px;font-weight:800;box-shadow:none}.structured-actions button:hover,.structured-actions a:hover{background:#eee0c9;border-color:#cdb18b;color:#65462d}.structured-actions svg{width:20px;height:20px}.structured-actions button:focus-visible,.structured-actions a:focus-visible{outline:3px solid #6c875d;outline-offset:2px}
.structured-store .structured-hint{background:#fffaf1!important;color:#a08a70;font-size:9px;padding:0 12px 12px!important;flex-shrink:0}.structured-notice{border-bottom:1px solid #d3dfc0;flex-shrink:0}.structured-notice strong{font-size:11px!important;font-weight:700;color:#577149}.structured-notice button{padding:4px 7px;border:0;background:transparent;box-shadow:none;color:#70845b}.structured-store .overlay-shade{padding:14px;background:#33271985;backdrop-filter:blur(2px)}.structured-store .overlay-panel{padding:20px;background:#fffaf1;border:1px solid #ddcbb3;border-radius:20px;box-shadow:0 6px 24px #3c281e21;gap:16px}.structured-store .overlay-panel .section-head{font-size:19px;letter-spacing:-.04em;color:#533d2b}.structured-store .overlay-panel .btn.secondary{box-shadow:none;border-width:1px;background:#f4ead9}.structured-store .chat-messages{border:1px solid #e8dac5;background:#f7f0e4;padding:12px;height:220px}.structured-store .chat-line{font-size:12px;line-height:1.6}.structured-store .chat-line strong{color:#886748}.structured-store .privacy{margin:0;font-size:10px;line-height:1.7;color:#9b846a}.structured-store .overlay-panel .input{font-size:12px;border-width:1px;background:#fffdf7;padding:11px 12px}.structured-store .overlay-panel .pill{font-size:11px;padding:7px 10px}.structured-store>.page{min-height:0;flex:1;font-size:12px;color:#90775d}
.structured-store .structured-hint{display:flex;align-items:center;justify-content:center;gap:8px;min-height:36px;padding:2px 12px 9px!important;line-height:1.3}.structured-hint span{min-width:0}.structured-store .yarn-toss{flex-shrink:0;min-height:27px;padding:3px 7px;border:1px solid #8b6888;border-radius:4px;background:#e6cfdf;box-shadow:2px 2px 0 #8b6888;color:#553e5a;font:700 9px Silkscreen,monospace;cursor:pointer}.structured-store .yarn-toss:focus-visible{outline:3px solid #6c875d;outline-offset:2px}.structured-store .yarn-toss:disabled{opacity:.5;cursor:default}
.structured-store .game-stage :deep(canvas){touch-action:none}
.game-shell .store-dialog{min-width:0;gap:14px;padding:18px;overscroll-behavior:contain}
.game-shell .feedback-dialog{--feedback-padding:18px}.game-shell .feedback-dialog .dialog-header{position:sticky;top:calc(-1 * var(--feedback-padding));margin-top:calc(-1 * var(--feedback-padding));padding-top:var(--feedback-padding);z-index:1;background:#fff3da}
.dialog-header{display:grid;grid-template-columns:minmax(0,1fr) 36px;align-items:center;gap:12px;padding-bottom:12px;border-bottom:1px solid #e5d7c3}
.game-shell .dialog-header .section-head{margin:0;min-width:0;line-height:1.25;overflow-wrap:anywhere}
.game-shell .store-dialog .btn{display:flex;align-items:center;justify-content:center;min-height:44px;margin:0;box-shadow:none;line-height:1.2;white-space:nowrap}
.game-shell .store-dialog .dialog-close{width:36px;min-height:36px;height:36px;padding:0;border-radius:10px;font-size:24px;font-weight:400}
.store-dialog>p{margin:0;font-size:13px;line-height:1.65;overflow-wrap:anywhere}.dialog-action{width:100%}
.menu-greeting,.menu-message{font-size:13px;line-height:1.6}.visitor-menu{list-style:none;margin:0;padding:0;max-height:45dvh;overflow-y:auto;border:2px solid #c7a576;background:#f2e4c9}.visitor-menu li{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:10px 12px;border-bottom:1px dashed #c7a576;font-size:13px;line-height:1.5}.visitor-menu li:last-child{border-bottom:0}.visitor-menu li span{min-width:0;overflow-wrap:anywhere}.visitor-menu strong{white-space:nowrap;color:#674731;font-family:Silkscreen,monospace;font-size:11px}
.order-status-group{min-width:0;padding:12px;border:1px solid #e8dac6;border-radius:12px;background:#f8f1e6}
.order-status-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;font-size:12px;color:#6d5239}.order-status-heading>span{display:grid;place-items:center;min-width:23px;height:23px;padding-inline:5px;border-radius:7px;background:#eadecc;color:#836b51;font-size:10px;font-weight:800}
.order-chips{display:flex;flex-wrap:wrap;align-items:center;gap:7px;min-width:0;min-height:28px}.order-chips small{font-size:12px}.game-shell .order-chips .pill{max-width:100%;white-space:normal;overflow-wrap:anywhere;line-height:1.4}
.chat-form{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:stretch;gap:8px;min-width:0}.game-shell .chat-form .input{min-width:0;min-height:44px;margin:0;line-height:1.4}.chat-form>.btn{min-width:64px;padding-inline:14px}
.game-shell .store-dialog .chat-messages{min-width:0;height:clamp(110px,26dvh,220px);margin:0}.chat-empty{padding:8px;line-height:1.6}.chat-line{min-width:0}
.reaction-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));align-items:stretch;gap:8px}.game-shell .store-dialog .reaction-choice{min-width:0;min-height:82px;padding:12px 4px;flex-direction:column;gap:8px;border-radius:12px;font-size:10px}.reaction-symbol{display:block;font-size:26px;line-height:1}
.store-dialog button:focus-visible,.store-dialog input:focus-visible{outline:3px solid #6c875d;outline-offset:2px}
@media(max-width:599px){.game-shell .feedback-dialog{--feedback-padding:16px}.structured-store{height:100dvh;min-height:520px;width:100%;max-height:none;margin:0;border:0;border-radius:0;box-shadow:none}.structured-store-top{padding:14px 16px}.bakery-status-strip{padding:10px 16px}.structured-actions{padding-inline:12px;gap:7px}.structured-store .overlay-panel{max-height:min(78dvh,600px)}.game-shell .overlay-shade{padding:12px}.game-shell .store-dialog{padding:16px;gap:12px}.game-shell .dialog-header .section-head{font-size:18px}.reaction-grid{gap:6px}}
@media(max-width:360px){.structured-actions{grid-template-columns:repeat(3,minmax(0,1fr));row-gap:7px}.structured-actions button{min-height:43px;flex-direction:row;gap:4px}.structured-actions svg{width:17px;height:17px}}
@media(prefers-reduced-motion:reduce){.structured-store .overlay-shade{backdrop-filter:none}}
</style>

<style scoped src="../assets/css/pixel-store.css"/>
