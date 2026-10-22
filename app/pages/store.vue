<script setup lang="ts">
import type { Player } from '../../game/createGame'
import { isAvatar } from '../../shared/avatars'
import { reactionOptions } from '../../shared/reactions'
import { orderStatusLabels,type OrderStatus } from '../../shared/order-status'
import type { ChatMessage } from '../../shared/chat'
import type { CustomerOrderSummary, CustomerOrderDetail } from '../../shared/customer-order'
import {playChatSound} from '../utils/chatSound'
import type {JukeboxMyVote,JukeboxState} from '../../shared/jukebox'
import {canSetVolume,createJukeboxPlayer,readJukeboxPrefs,saveJukeboxPrefs,type JukeboxListenStatus,type JukeboxPlayer} from '../utils/jukeboxPlayer'
const route=useRoute()
const featureConfig=useRuntimeConfig().public
// Runtime flags can disable a feature for everyone; query switches isolate one browser for profiling.
const catEnabled=computed(()=>String(featureConfig.storeCatEnabled)!=='false'&&route.query.cat!=='0')
const guideEnabled=computed(()=>String(featureConfig.storeGuideEnabled)!=='false'&&route.query.guide!=='0')
type Status = OrderStatus
type PublicOrder = { id:number; number:string; name:string|null; status:Status }
type MenuState = { date:string; version:string; items:{id:number;name:string;priceCentavos:number}[] }
type Me = { nickname:string; avatar:string }
const me=ref<Me|null>(null), board=ref<PublicOrder[]>([]), players=ref<Player[]>([]), selfId=ref('')
const menu=ref<MenuState>({date:'',version:'',items:[]}),menuLoading=ref(false),menuError=ref('')
const cart=ref<Record<number,number>>({}),placingOrder=ref(false),checkoutError=ref('')
const checkoutDialog=ref<HTMLDialogElement|null>(null)
const myOrders=ref<CustomerOrderSummary[]>([]),selectedOrderId=ref<number|null>(null),orderDetail=ref<CustomerOrderDetail|null>(null),orderMessage=ref(''),orderSending=ref(false),orderChatError=ref(''),orderInboxLoading=ref(false),chatTab=ref<'community'|'orders'>('community')
const cartLines=computed(()=>menu.value.items.filter(item=>(cart.value[item.id]??0)>0).map(item=>({...item,quantity:cart.value[item.id]!,lineTotalCentavos:item.priceCentavos*cart.value[item.id]!})))
const cartTotal=computed(()=>cartLines.value.reduce((sum,item)=>sum+item.lineTotalCentavos,0))
const privateUnread=computed(()=>myOrders.value.reduce((sum,order)=>sum+order.unread,0))
const allUnread=computed(()=>unreadChat.value+privateUnread.value)
const featuredOrder=computed(()=>myOrders.value.find(order=>order.unread>0)||myOrders.value[0])
let inboxInitialized=false,inboxPolling=false
let menuStale=true,menuEpoch=0,wantedMenuVersion:string|null=null,hasWelcomed=false,hiddenAt=0
let menuReloadAfterCurrent=false
const menuDate=computed(()=>menu.value.date===manilaDate()?new Date(`${menu.value.date}T12:00:00`).toLocaleDateString('en-PH',{month:'long',day:'numeric'}):'today')
const hasCurrentMenu=computed(()=>Boolean(menu.value.version&&menu.value.date===manilaDate()))
// Item names the walking menu guide may mention; null while today's menu is unknown or has just changed.
const guideMenuItems=ref<string[]|null>(null)
const visitorAvatar=computed(()=>isAvatar(me.value?.avatar)?me.value.avatar:'mochi')
const online=computed(()=>players.value.length)
const overlay=ref(''), message=ref(''), chat=ref<ChatMessage[]>([]), unreadChat=ref(0), notice=ref(''), connected=ref(false), returningHome=ref(false), chatEnabled=ref(true)
const jukebox=ref<JukeboxState|null>(null),jukeboxVote=ref<JukeboxMyVote>(null),jukeboxPendingVote=ref(''),jukeboxMessage=ref(''),jukeboxClock=ref(Date.now())
const musicStatus=ref<JukeboxListenStatus>('off'),musicOn=ref(false),musicVolume=ref(.35),musicVolumeAdjustable=ref(true)
// The header indicator reads ON only while this visitor actually hears the shared music.
const musicListening=computed(()=>musicOn.value&&!['off','needs_gesture'].includes(musicStatus.value))
const jukeboxScene=computed(()=>({playing:Boolean(jukebox.value?.enabled&&jukebox.value.nowPlaying),audible:musicStatus.value==='playing'}))
let musicPlayer:JukeboxPlayer|undefined,pingSentAt=0
let jukeboxClockTimer:ReturnType<typeof setInterval>|undefined,jukeboxVoteTimeout:ReturnType<typeof setTimeout>|undefined
const game=ref<{showBubble:(id:string,text:string)=>void;showStaffBubble:(text:string)=>void;movePlayer:(id:string,x:number,y:number)=>void;tossYarn:()=>boolean|undefined}|null>(null)
const leaveDialog=ref<{open:()=>void;close:()=>void}|null>(null),leaving=ref(false)
const visitThanks=useState<boolean>('visit-thanks',()=>false)
const feedbackBox=ref<{refresh:()=>Promise<void>}|null>(null)
const orderFeed=ref<HTMLElement|null>(null)
let socket:WebSocket|null=null, alive=true, reconnect:ReturnType<typeof setTimeout>|undefined, heartbeat:ReturnType<typeof setInterval>|undefined,boardRefresh:ReturnType<typeof setInterval>|undefined,inboxTimer:ReturnType<typeof setInterval>|undefined,menuDayTimer:ReturnType<typeof setTimeout>|undefined
const preparing=computed(()=>board.value.filter(o=>o.status==='Preparing').length)
const ready=computed(()=>board.value.filter(o=>o.status==='Ready').length)
const headerTime=computed(()=>new Date().getHours()<12?'Good morning!':new Date().getHours()<18?'Good afternoon!':'Good evening!')
const statusOptions:Status[]=['Preparing','Ready','Served']
watch([overlay,chatTab],([value,tab])=>{if(value==='chat'&&tab==='community')unreadChat.value=0})
// The progress bar ticks only while the jukebox panel is open.
watch(overlay,value=>{
  clearInterval(jukeboxClockTimer);jukeboxClockTimer=undefined
  if(value!=='jukebox')return
  const tick=()=>{jukeboxClock.value=musicPlayer?.serverNow()??Date.now()}
  tick();jukeboxClockTimer=setInterval(tick,500)
})
onMounted(async()=>{
  document.addEventListener('visibilitychange',onVisibilityChanged)
  scheduleNextMenuDay()
  try { me.value=await $fetch<Me>('/api/me');if(alive)setupMusic();void loadMenu();await Promise.all([loadBoard(),loadOrderInbox()]);if(alive){connect();boardRefresh=setInterval(()=>void loadBoard(),30_000);inboxTimer=setInterval(()=>void pollOrderInbox(),3000)} }
  catch { void returnHome() }
})
onBeforeUnmount(()=>{alive=false;document.removeEventListener('visibilitychange',onVisibilityChanged);stopMusic();clearInterval(jukeboxClockTimer);clearTimeout(jukeboxVoteTimeout);clearTimeout(reconnect);clearInterval(heartbeat);clearInterval(boardRefresh);clearInterval(inboxTimer);clearTimeout(menuDayTimer);socket?.close()})
function setupMusic(){
  const prefs=readJukeboxPrefs()
  musicOn.value=prefs.on;musicVolume.value=prefs.volume;musicVolumeAdjustable.value=canSetVolume()
  musicPlayer=createJukeboxPlayer(status=>{musicStatus.value=status})
  musicPlayer.setVolume(prefs.volume)
  // A remembered "on" still waits for the browser: the player asks for a tap if autoplay is blocked.
  if(prefs.on)musicPlayer.enable()
}
function saveMusicPrefs(){saveJukeboxPrefs({on:musicOn.value,volume:musicVolume.value})}
function toggleMusic(){
  if(!musicPlayer)return
  if(musicOn.value&&musicStatus.value==='needs_gesture'){musicPlayer.resume();return}
  musicOn.value=!musicOn.value
  if(musicOn.value)musicPlayer.enable();else musicPlayer.disable()
  saveMusicPrefs()
}
function setMusicVolume(value:number){musicVolume.value=value;musicPlayer?.setVolume(value);saveMusicPrefs()}
function stopMusic(){musicPlayer?.dispose();musicPlayer=undefined;musicStatus.value='off'}
function ping(){pingSentAt=Date.now();send({type:'ping'})}
function applyJukebox(state:JukeboxState,myVote?:JukeboxMyVote){
  const roundChanged=jukebox.value?.round!==state.round
  musicPlayer?.noteStateTime(state.serverNow)
  jukebox.value=state
  if(myVote!==undefined)jukeboxVote.value=myVote
  else if(roundChanged)jukeboxVote.value=null
  if(roundChanged){jukeboxPendingVote.value='';jukeboxMessage.value=''}
  musicPlayer?.setTimeline(state.enabled?state.nowPlaying:null)
}
function voteJukebox(trackId:string){
  const state=jukebox.value
  if(!state?.votingEnabled||!connected.value||jukeboxPendingVote.value)return
  if(jukeboxVote.value?.round===state.round&&jukeboxVote.value.trackId===trackId)return
  jukeboxPendingVote.value=trackId;jukeboxMessage.value=''
  send({type:'jukebox_vote',trackId,round:state.round})
  clearTimeout(jukeboxVoteTimeout)
  jukeboxVoteTimeout=setTimeout(()=>{if(jukeboxPendingVote.value===trackId){jukeboxPendingVote.value='';jukeboxMessage.value='Your vote did not go through. Please try again.'}},5000)
}
const jukeboxRejections:Record<string,string>={disabled:'The jukebox is off right now.',voting_off:'Song voting is paused by staff.',round_closed:'That round just ended. Vote again for the next song.',not_candidate:'That song is no longer on the list.',slow_down:'Please wait a moment before changing your vote.'}
async function loadBoard(){try{board.value=await $fetch<PublicOrder[]>('/api/orders/board')}catch{}}
function money(cents:number){return `₱${(cents/100).toFixed(2)}`}
function changeQuantity(id:number,amount:number){const next=Math.max(0,Math.min(20,(cart.value[id]||0)+amount));cart.value={...cart.value,[id]:next};checkoutError.value=''}
function openCheckoutConfirmation(){
  if(placingOrder.value||menuLoading.value||!cartLines.value.length||!hasCurrentMenu.value)return
  checkoutError.value=''
  checkoutDialog.value?.showModal()
}
async function placeOrder(){
  if(!checkoutDialog.value?.open||placingOrder.value||menuLoading.value||!cartLines.value.length||!hasCurrentMenu.value)return
  placingOrder.value=true;checkoutError.value=''
  try{
    const detail=await $fetch<CustomerOrderDetail>('/api/orders',{method:'POST',body:{items:cartLines.value.map(item=>({id:item.id,quantity:item.quantity}))}})
    checkoutDialog.value?.close()
    cart.value={};orderDetail.value=detail;selectedOrderId.value=detail.order.id;chatTab.value='orders';overlay.value='chat'
    await scrollOrderMessages()
    notice.value=`Order request #${detail.order.number} sent · ${money(detail.order.totalCentavos)}. Waiting for staff confirmation.`
    await Promise.all([loadOrderInbox(),loadBoard()])
  }catch(e:any){checkoutDialog.value?.close();checkoutError.value=e?.data?.statusMessage||'Could not place your order. Please try again.';menuStale=true;void loadMenu(true)}
  finally{placingOrder.value=false}
}
async function loadOrderInbox(){
  if(!alive||inboxPolling)return
  inboxPolling=true
  try{
    const next=await $fetch<CustomerOrderSummary[]>('/api/orders/mine')
    if(!alive)return
    const unread=next.reduce((sum,order)=>sum+order.unread,0)
    if(inboxInitialized&&unread>privateUnread.value&&!document.hidden)playChatSound()
    inboxInitialized=true;myOrders.value=next
    if(selectedOrderId.value&&!next.some(order=>order.id===selectedOrderId.value)){selectedOrderId.value=null;orderDetail.value=null}
  }catch{}finally{inboxPolling=false}
}
async function pollOrderInbox(){
  if(document.hidden||(!myOrders.value.length&&!(overlay.value==='chat'&&chatTab.value==='orders')))return
  await loadOrderInbox()
  if(overlay.value==='chat'&&chatTab.value==='orders'&&selectedOrderId.value)await loadOrderDetail(selectedOrderId.value)
}
async function loadOrderDetail(id:number){
  try{const detail=await $fetch<CustomerOrderDetail>(`/api/orders/${id}`);if(selectedOrderId.value!==id||!alive)return;const previous=orderDetail.value?.messages.at(-1)?.id;orderDetail.value=detail;myOrders.value=myOrders.value.map(order=>order.id===id?{...order,unread:0,status:detail.order.status}:order);if(previous!==detail.messages.at(-1)?.id)await scrollOrderMessages()}
  catch(e:any){orderChatError.value=e?.data?.statusMessage||'Could not load this conversation.'}
}
async function openOrder(id:number){selectedOrderId.value=id;orderDetail.value=null;orderChatError.value='';orderInboxLoading.value=true;await loadOrderDetail(id);orderInboxLoading.value=false}
async function openOrderInbox(id:number){chatTab.value='orders';overlay.value='chat';await openOrder(id)}
async function scrollOrderMessages(){await nextTick();if(orderFeed.value)orderFeed.value.scrollTop=orderFeed.value.scrollHeight}
async function sendOrderChat(){
  const text=orderMessage.value.trim(),id=selectedOrderId.value
  if(orderSending.value||!id||!text||text.length>500)return
  orderSending.value=true;orderChatError.value=''
  try{const detail=await $fetch<CustomerOrderDetail>(`/api/orders/${id}/messages`,{method:'POST',body:{text}});orderMessage.value='';orderDetail.value=detail;await scrollOrderMessages();await loadOrderInbox()}
  catch(e:any){orderChatError.value=e?.data?.statusMessage||'Could not send your message.'}
  finally{orderSending.value=false}
}
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
    menuStale=true;menuEpoch++;guideMenuItems.value=null
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
    if(menu.value.version&&menu.value.version!==current.version&&Object.values(cart.value).some(Boolean)){cart.value={};checkoutError.value='Today’s menu changed. Please choose your items again.'}
    menu.value=current
    menuStale=(startedAtEpoch!==menuEpoch&&(!wantedMenuVersion||current.version!==wantedMenuVersion))||current.date!==manilaDate()
    if(!menuStale)wantedMenuVersion=null
    guideMenuItems.value=menuStale?null:current.items.map(item=>item.name)
  }catch{menuStale=true;menuError.value='Could not load today’s menu. Please try again.'}
  finally{
    menuLoading.value=false
    if(menuReloadAfterCurrent){menuReloadAfterCurrent=false;if(menuStale&&alive&&!document.hidden)void loadMenu(true)}
  }
}
function onMenuUpdated(version:unknown){
  const next=typeof version==='string'?version:null
  if(next&&(next===menu.value.version||next===wantedMenuVersion))return
  wantedMenuVersion=next;menuStale=true;menuEpoch++;guideMenuItems.value=null
  if(overlay.value==='menu'&&!document.hidden)void loadMenu(true)
}
function onVisibilityChanged(){
  musicPlayer?.setHidden(document.hidden)
  if(document.hidden){hiddenAt=Date.now();return}
  if(overlay.value==='chat'&&chatTab.value==='community')unreadChat.value=0
  void loadOrderInbox()
  if(menuStale||menu.value.date!==manilaDate()||(hiddenAt&&Date.now()-hiddenAt>5000)){
    menuStale=true;menuEpoch++;void loadMenu(true)
  }
  hiddenAt=0
}
async function returnHome(){
  if(!alive||returningHome.value)return
  returningHome.value=true
  stopMusic()
  clearTimeout(reconnect);clearInterval(heartbeat);clearInterval(boardRefresh);clearInterval(inboxTimer);clearTimeout(menuDayTimer)
  const current=socket;socket=null;current?.close()
  try{const result=await navigateTo('/',{replace:true});if(result===false)window.location.replace('/')}
  catch{window.location.replace('/')}
}
function connect(){
  if(!alive||returningHome.value)return
  const current=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`)
  socket=current
  current.onopen=()=>{clearInterval(heartbeat);ping();heartbeat=setInterval(ping,20_000)}
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
      if(entry.id!==selfId.value){
        if(overlay.value!=='chat'||chatTab.value!=='community'||document.hidden)unreadChat.value=Math.min(99,unreadChat.value+1)
        if(!document.hidden)playChatSound()
      }
      if(entry.role==='staff')game.value?.showStaffBubble(entry.text)
      else game.value?.showBubble(entry.id,entry.text)
    }
    if(data.type==='chat_reset'){chat.value=[];unreadChat.value=0}
    if(data.type==='emote')game.value?.showBubble(data.id,data.emoji)
    if(data.type==='feedback_changed')void feedbackBox.value?.refresh()
    if(data.type==='menu:updated'||data.type==='menu_changed')onMenuUpdated(data.version)
    if(data.type==='order_changed'){
      await loadBoard()
      if(myOrders.value.some(order=>order.id===data.order?.id)){
        const previous=myOrders.value.find(order=>order.id===data.order?.id)?.status
        void loadOrderInbox()
        if(previous==='Pending'&&data.order?.status==='Preparing') notice.value=`✓ Staff confirmed order #${data.order.number}. Preparing now!`
        if(data.order?.status==='Ready') notice.value=`🔔 Your order #${data.order.number} is ready!`
        if(data.order?.status==='Served') notice.value=`🍡 Your order #${data.order.number} is out for delivery.`
        if(data.order?.status==='Delivered') notice.value=`✓ Your order #${data.order.number} has been delivered. Thank you!`
      }
    }
    if(data.type==='pong'&&typeof data.serverTime==='number')musicPlayer?.noteServerTime(data.serverTime,pingSentAt,Date.now())
    if(data.type==='jukebox'&&data.state&&typeof data.state==='object')applyJukebox(data.state,data.myVote)
    if(data.type==='jukebox_votes'&&jukebox.value&&data.round===jukebox.value.round)jukebox.value={...jukebox.value,votes:data.votes||{},upNext:data.upNext??null}
    if(data.type==='jukebox_vote_ok'){clearTimeout(jukeboxVoteTimeout);jukeboxPendingVote.value='';if(jukebox.value?.round===data.round)jukeboxVote.value={round:data.round,trackId:data.trackId}}
    if(data.type==='jukebox_vote_rejected'){clearTimeout(jukeboxVoteTimeout);jukeboxPendingVote.value='';jukeboxMessage.value=jukeboxRejections[data.reason]||'Could not save your vote.'}
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
function openChat(){chatTab.value='community';overlay.value='chat'}
function interact(kind:string){if(kind==='leave'){leaveDialog.value?.open();return}overlay.value=kind;if(kind==='menu')void loadMenu()}
async function leave(){
  if(leaving.value)return
  leaving.value=true;visitThanks.value=true
  try{await navigateTo('/')}
  catch{visitThanks.value=false;leaving.value=false;leaveDialog.value?.close();notice.value='Could not leave right now. Please try again.'}
}
</script>
<template><main class="game-shell structured-store">
  <header class="structured-store-top">
    <div class="visitor-identity"><span class="visitor-portrait"><PixelSprite :name="`head-${visitorAvatar}`" :scale="2"/></span><div class="visitor-copy"><span>CHITS STORE</span><strong :title="me?.nickname">{{ me?.nickname || 'Guest' }}</strong></div></div>
    <div class="visit-status">
      <span class="connection-pill" :class="{ready:connected}" role="status"><span class="connection-dot" aria-hidden="true"/>{{ connected?`${online} online`:'Connecting' }}</span>
      <button type="button" class="music-toggle" data-music-control :aria-label="musicListening?'Mute jukebox music':'Turn on jukebox music'" :aria-pressed="musicListening" :title="jukebox?.enabled&&jukebox.nowPlaying?`Now playing: ${jukebox.nowPlaying.track.title}`:undefined" :disabled="!me||returningHome" @click="toggleMusic"><StoreGlyph name="note"/>{{ musicListening?'Music on':'Music off' }}</button>
    </div>
  </header>
  <template v-if="me&&!returningHome">
    <div class="game-stage">
      <aside v-if="notice" class="structured-notice" role="status"><strong>{{ notice }}</strong><button type="button" aria-label="Dismiss notice" @click="notice=''">✕</button></aside>
      <ClientOnly><GameCanvas :key="`${catEnabled}-${guideEnabled}`" ref="game" :nickname="me.nickname" :avatar="me.avatar" :players="players" :self-id="selfId" :board="board" :cat-enabled="catEnabled" :guide-enabled="guideEnabled" :controls-enabled="!overlay&&!leaving" :jukebox="jukeboxScene" :menu-items="guideMenuItems" @move="p=>send({type:'move',x:p.x,y:p.y})" @interact="interact"/></ClientOnly>
    </div>
    <button v-if="featuredOrder" type="button" class="order-inbox-shortcut" :class="{'has-reply':privateUnread>0}" :aria-label="privateUnread?`Order inbox, ${privateUnread} unread staff ${privateUnread===1?'reply':'replies'}. Open order ${featuredOrder.number}`:`Open order inbox for order ${featuredOrder.number}`" @click="openOrderInbox(featuredOrder.id)"><span class="order-inbox-shortcut-icon"><StoreGlyph name="chat"/><span v-if="privateUnread" class="order-inbox-shortcut-count" aria-hidden="true">{{ privateUnread>9?'9+':privateUnread }}</span></span><span class="order-inbox-shortcut-copy"><strong>{{ privateUnread?'New reply from staff':'Your order inbox' }}</strong><small>Order #{{ featuredOrder.number }}{{ featuredOrder.name?` · ${featuredOrder.name}`:'' }} · {{ orderStatusLabels[featuredOrder.status] }}</small></span><span class="order-inbox-shortcut-action">{{ privateUnread?'Read reply':'Open inbox' }} →</span></button>
    <nav class="structured-actions" aria-label="Store actions">
      <button type="button" class="store-chat-action" aria-label="Chat" :aria-describedby="allUnread?'store-chat-unread':undefined" @click="openChat"><StoreGlyph name="chat"/><span>Chat</span><span v-if="allUnread" class="chat-unread-badge" aria-hidden="true">{{ allUnread>9?'9+':allUnread }}</span><span id="store-chat-unread" class="chat-sr-only">{{ allUnread }} unread {{ allUnread===1?'message':'messages' }}</span></button>
      <button type="button" @click="interact('menu')"><StoreGlyph name="book"/><span>Menu</span></button>
      <button type="button" @click="overlay='board'"><StoreGlyph name="orders"/><span>Orders</span></button>
      <button type="button" @click="overlay='emotes'"><StoreGlyph name="cat"/><span>Emotes</span></button>
      <button type="button" @click="overlay='feedback'"><StoreGlyph name="pencil"/><span>Feedback</span></button>
      <button type="button" @click="leaveDialog?.open()"><StoreGlyph name="door"/><span>Leave</span></button>
    </nav>
    <div v-if="catEnabled" class="structured-hint"><p class="cat-hint-copy"><span class="cat-hint-faces"><PixelSprite name="cat-face" :scale="2"/><PixelSprite name="onay-face" :scale="2"/></span><span>Drag yarn · tap Miming or Onay to pet</span></p><button type="button" class="cat-action toss-yarn" aria-label="Toss yarn for Miming and Onay, the shop cats" :disabled="!!overlay" @click="game?.tossYarn()"><StoreGlyph name="yarn"/>Toss yarn</button></div>
    <div v-if="overlay" class="overlay-shade" :class="{'chat-overlay':overlay==='chat'||overlay==='jukebox'}" @click.self="overlay=''">
      <section class="overlay-panel stack store-dialog" :class="{'feedback-dialog':overlay==='feedback','chat-dialog':overlay==='chat','jukebox-dialog':overlay==='jukebox','order-chat-dialog':overlay==='chat'&&chatTab==='orders'&&!!selectedOrderId}" role="dialog" aria-labelledby="store-dialog-title">
        <header class="dialog-header"><h2 id="store-dialog-title" class="section-head">{{ overlay==='chat'?(chatTab==='orders'?'Order inbox':'Community chat'):{menu:"Today's Menu",board:'Live Order Board',cashier:'Staff',chef:'Chef',emotes:'Reactions',feedback:'Feedback box',jukebox:'Jukebox'}[overlay]||overlay }}</h2><button type="button" class="btn secondary dialog-close" aria-label="Close dialog" @click="overlay=''"><span aria-hidden="true">×</span></button></header>
        <FeedbackBox v-if="overlay==='feedback'" ref="feedbackBox"/>
        <JukeboxPanel v-if="overlay==='jukebox'" :state="jukebox" :my-vote="jukeboxVote" :pending-vote="jukeboxPendingVote" :message="jukeboxMessage" :status="musicStatus" :music-on="musicOn" :volume="musicVolume" :volume-adjustable="musicVolumeAdjustable" :server-now="jukeboxClock" :connected="connected" @vote="voteJukebox" @toggle="toggleMusic" @volume="setMusicVolume"/>
        <template v-if="overlay==='menu'">
          <p class="menu-greeting">🍡 Hi, {{ me.nickname }}! Here’s the meryenda for {{ menuDate }}.</p>
          <p v-if="!hasCurrentMenu&&menuLoading" class="menu-message">Checking today’s menu…</p>
          <p v-else-if="!hasCurrentMenu&&menuError" class="menu-message" role="alert">{{ menuError }}</p>
          <p v-else-if="!hasCurrentMenu||!menu.items.length" class="menu-message">Today’s menu hasn’t been posted yet. Please check back soon!</p>
          <ul v-else class="visitor-menu"><li v-for="item in menu.items" :key="item.id"><div class="menu-item-label"><span>{{ item.name }}</span><strong>{{ money(item.priceCentavos) }}</strong></div><div class="menu-quantity"><button type="button" :aria-label="`Remove one ${item.name}`" :disabled="!cart[item.id]||placingOrder" @click="changeQuantity(item.id,-1)">−</button><span :aria-label="`${cart[item.id]||0} in cart`">{{ cart[item.id]||0 }}</span><button type="button" :aria-label="`Add one ${item.name}`" :disabled="(cart[item.id]||0)>=20||placingOrder" @click="changeQuantity(item.id,1)">+</button></div></li></ul>
          <div v-if="cartLines.length" class="cart-summary"><strong>Your cart</strong><div v-for="item in cartLines" :key="item.id"><span>{{ item.quantity }} × {{ item.name }}</span><span>{{ money(item.lineTotalCentavos) }}</span></div><div class="cart-total"><strong>Total</strong><strong>{{ money(cartTotal) }}</strong></div><p class="privacy">Staff will confirm your request before preparing it.</p><button type="button" class="btn" :disabled="placingOrder||menuLoading||!hasCurrentMenu" @click="openCheckoutConfirmation">Send order request</button></div>
          <p v-if="checkoutError" class="error" role="alert">{{ checkoutError }}</p>
          <p v-if="hasCurrentMenu&&menuLoading" class="menu-message">Updating today’s menu…</p>
          <p v-if="hasCurrentMenu&&menuError" class="menu-message" role="alert">{{ menuError }}</p>
          <button type="button" class="btn small secondary dialog-action" :disabled="menuLoading" @click="loadMenu(true)">Refresh menu</button>
        </template>
        <template v-if="overlay==='board'">
          <section class="order-status-group" v-for="status in statusOptions" :key="status" :aria-label="`${orderStatusLabels[status]} orders`"><div class="order-status-heading"><strong>{{ orderStatusLabels[status] }}</strong><span>{{ board.filter(o=>o.status===status).length }}</span></div><div class="order-chips"><span v-for="o in board.filter(b=>b.status===status)" :key="o.id" class="pill" :class="{ready:status==='Ready',served:status==='Served'}"><strong>{{ o.number }}</strong><small v-if="o.name">{{ o.name }}</small></span><small v-if="!board.some(o=>o.status===status)" class="muted">No orders</small></div></section>
          <p class="privacy">Order numbers and names added by staff are visible to everyone here. For an order you placed, open Chat → Order inbox to message staff privately.</p>
          <button class="btn small secondary dialog-action" @click="loadBoard">Refresh board</button>
        </template>
        <template v-else-if="overlay==='cashier'"><p>🍮 {{ headerTime }} Welcome to Chits Store, {{ me.nickname }}!</p><p>{{ preparing }} order(s) preparing · {{ ready }} ready. You can check the live board anytime.</p><button class="btn small dialog-action" @click="overlay='board'">View orders</button><p class="help-text">Tap anywhere on the floor or use the joystick to move. Tap the chef or order board to interact.</p></template>
        <template v-else-if="overlay==='chef'"><p>👨‍🍳 🍡 {{ preparing ? 'Stirring up tasty orders right now!' : 'Trying a fresh batch of meryenda!' }}</p><p class="help-text">Only staff can change real order statuses.</p></template>
        <template v-else-if="overlay==='emotes'"><div class="reaction-grid"><button v-for="reaction in reactionOptions" :key="reaction.emoji" type="button" class="btn secondary reaction-choice" @click="send({type:'emote',emoji:reaction.emoji});overlay=''"><PixelReaction class="reaction-symbol" :emoji="reaction.emoji"/><span>{{ reaction.label }}</span></button></div></template>
        <template v-else-if="overlay==='chat'">
          <div class="chat-tabs" role="tablist" aria-label="Chat conversations"><button type="button" role="tab" :aria-selected="chatTab==='community'" @click="chatTab='community'">Community <span v-if="unreadChat">{{ unreadChat }}</span></button><button type="button" role="tab" :aria-selected="chatTab==='orders'" @click="chatTab='orders';void loadOrderInbox()">Order inbox <span v-if="privateUnread">{{ privateUnread }}</span></button></div>
          <template v-if="chatTab==='community'"><div class="chat-messages" aria-live="polite"><div v-if="chat.length===0" class="muted help-text chat-empty">Say hello! Chat messages are temporary.</div><div v-for="c in chat" :key="c.messageId" class="chat-line" :class="{'staff-reply':c.role==='staff'}"><span v-if="c.role==='staff'" class="chat-staff-tag">STAFF</span><strong>{{ c.nickname }}:</strong> {{ c.text }}</div></div><form class="chat-form" @submit.prevent="sendChat"><input v-model="message" class="input" maxlength="160" aria-label="Chat message" placeholder="Say hi..." autocomplete="off"><button class="btn small" type="submit" :disabled="!connected||!message.trim()||!chatEnabled">Send</button></form><p v-if="!chatEnabled" class="privacy">Chat is temporarily disabled by staff.</p><p class="privacy">Public room: do not share personal details. Staff can mute or remove visitors. Chat is not permanently stored.</p></template>
          <template v-else><div v-if="myOrders.length" class="order-inbox-list"><button v-for="order in myOrders" :key="order.id" type="button" :class="{selected:selectedOrderId===order.id}" @click="openOrder(order.id)"><strong>#{{ order.number }} <span v-if="order.unread" class="order-inbox-unread">{{ order.unread }}</span></strong><small>{{ orderStatusLabels[order.status] }} · {{ money(order.totalCentavos) }}</small></button></div><p v-else class="menu-message">Your placed orders will appear here. Choose items from Today’s Menu to start.</p>
            <p v-if="orderInboxLoading" class="help-text">Opening order conversation…</p>
            <template v-if="orderDetail&&selectedOrderId===orderDetail.order.id"><details class="order-chat-summary"><summary><span><strong>Order #{{ orderDetail.order.number }}{{ orderDetail.order.name?` · ${orderDetail.order.name}`:'' }}</strong> · {{ orderStatusLabels[orderDetail.order.status] }} · {{ money(orderDetail.order.totalCentavos) }}</span><small>Items ▾</small></summary><div v-for="item in orderDetail.items" :key="item.id"><span>{{ item.quantity }} × {{ item.name }}</span><span>{{ money(item.lineTotalCentavos) }}</span></div></details><div ref="orderFeed" class="chat-messages order-chat-messages" role="log" aria-label="Private order conversation" aria-live="polite"><div v-for="entry in orderDetail.messages" :key="entry.id" class="chat-line" :class="{'staff-reply':entry.role==='staff'}"><strong>{{ entry.role==='system'?'Order':entry.role==='staff'?'Chits Store':'You' }}:</strong> {{ entry.text }}</div></div><form class="chat-form" @submit.prevent="sendOrderChat"><input v-model="orderMessage" class="input" maxlength="500" aria-label="Message staff about this order" placeholder="Message staff about this order…" autocomplete="off"><button class="btn small" type="submit" :disabled="orderSending||!orderMessage.trim()">{{ orderSending?'Sending…':'Send' }}</button></form><p class="privacy">Only you and store staff can see this order conversation.</p></template>
            <p v-if="orderChatError" class="error" role="alert">{{ orderChatError }}</p>
          </template>
        </template>
      </section>
    </div>
    <dialog ref="checkoutDialog" class="checkout-confirmation" aria-labelledby="checkout-confirmation-title" aria-describedby="checkout-confirmation-description" @cancel="placingOrder&&$event.preventDefault()">
      <form class="checkout-confirmation-content" @submit.prevent="placeOrder">
        <h2 id="checkout-confirmation-title">Confirm your order</h2>
        <p id="checkout-confirmation-description">Please check your items before sending the request to staff.</p>
        <div class="checkout-confirmation-items"><div v-for="item in cartLines" :key="item.id"><span>{{ item.quantity }} × {{ item.name }}</span><strong>{{ money(item.lineTotalCentavos) }}</strong></div></div>
        <div class="checkout-confirmation-total"><span>Total</span><strong>{{ money(cartTotal) }}</strong></div>
        <p class="checkout-confirmation-note">Staff will confirm your request before preparing it. You can message them in your order inbox.</p>
        <div class="checkout-confirmation-actions"><button type="button" class="btn secondary" :disabled="placingOrder" @click="checkoutDialog?.close()">Back to menu</button><button type="submit" class="btn" :disabled="placingOrder||menuLoading||!cartLines.length||!hasCurrentMenu">{{ placingOrder?'Sending…':'Confirm & send' }}</button></div>
      </form>
    </dialog>
  </template>
  <div v-else class="page">{{ returningHome?'Returning to welcome...':'Opening the bakery...' }}</div>
  <VisitDialog ref="leaveDialog" variant="leave" :busy="leaving" @confirm="leave"/>
</main></template>
<style scoped>
.structured-store .overlay-shade{padding:14px;background:#33271985;backdrop-filter:blur(2px)}.structured-store .overlay-panel{padding:20px;background:#fffaf1;border:1px solid #ddcbb3;border-radius:20px;box-shadow:0 6px 24px #3c281e21;gap:16px}.structured-store .overlay-panel .section-head{font-size:19px;letter-spacing:-.04em;color:#533d2b}.structured-store .overlay-panel .btn.secondary{box-shadow:none;border-width:1px;background:#f4ead9}.structured-store .chat-messages{border:1px solid #e8dac5;background:#f7f0e4;padding:12px;height:220px}.structured-store .chat-line{font-size:12px;line-height:1.6}.structured-store .chat-line strong{color:#886748}.structured-store .privacy{margin:0;font-size:10px;line-height:1.7;color:#9b846a}.structured-store .overlay-panel .input{font-size:12px;border-width:1px;background:#fffdf7;padding:11px 12px}.structured-store .overlay-panel .pill{font-size:11px;padding:7px 10px}.structured-store>.page{min-height:0;flex:1;font-size:12px;color:#90775d}
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
@media(max-width:599px){.game-shell .feedback-dialog{--feedback-padding:16px}.structured-store .overlay-panel{max-height:min(78dvh,600px)}.game-shell .overlay-shade{padding:12px}.game-shell .store-dialog{padding:16px;gap:12px}.game-shell .dialog-header .section-head{font-size:18px}.reaction-grid{gap:6px}}
@media(prefers-reduced-motion:reduce){.structured-store .overlay-shade{backdrop-filter:none}}
.visitor-menu li{align-items:center}.menu-item-label{display:grid;gap:3px;min-width:0}.menu-item-label span{font-weight:700}.menu-quantity{display:flex;align-items:center;gap:7px;flex-shrink:0}.menu-quantity button{width:29px;height:29px;border:2px solid #765337;background:#fff5df;color:#674731;font:16px/1 Silkscreen,monospace}.menu-quantity>span{min-width:18px;text-align:center;font:11px Silkscreen,monospace}.cart-summary,.order-chat-summary{display:grid;gap:8px;padding:12px;border:2px solid #c7a576;background:#f5e8ce;font-size:12px}.cart-summary>div,.order-chat-summary>div{display:flex;justify-content:space-between;gap:10px}.cart-summary>div span:first-child,.order-chat-summary>div span:first-child{min-width:0;overflow-wrap:anywhere}.cart-summary .cart-total,.order-chat-summary .cart-total{padding-top:8px;border-top:1px dashed #b69464;font:11px Silkscreen,monospace}.cart-summary>.btn{width:100%;border-radius:0;font:11px Silkscreen,monospace}.chat-tabs{display:grid;grid-template-columns:1fr 1fr;gap:5px}.chat-tabs button{min-height:38px;border:2px solid #c7a576;background:#f5e8ce;color:#674731;font:10px Silkscreen,monospace}.chat-tabs button[aria-selected="true"]{background:#ddc399;border-color:#674731}.chat-tabs button span,.order-inbox-unread{display:inline-grid;place-items:center;min-width:17px;height:17px;padding:2px;background:#ad513f;color:#fff7e5;font:9px Silkscreen,monospace}.order-inbox-list{display:flex;gap:7px;overflow-x:auto;overscroll-behavior-x:contain;padding:2px 2px 7px}.order-inbox-list button{display:grid;gap:5px;flex:0 0 126px;min-height:56px;text-align:left;padding:7px;border:2px solid #c7a576;background:#fff7e5;color:#674731}.order-inbox-list button.selected{border-color:#674731;background:#e7d2ab}.order-inbox-list button strong{font:11px Silkscreen,monospace}.order-inbox-list button small{font:10px 'Courier New',monospace;line-height:1.4}.structured-store .order-chat-messages{height:clamp(100px,20dvh,180px)}
.game-shell .store-dialog.order-chat-dialog{max-height:min(78dvh,620px)}
.game-shell .store-dialog.jukebox-dialog{max-height:min(78dvh,640px);overflow-y:auto}
.order-inbox-shortcut{display:flex;align-items:center;gap:11px;flex-shrink:0;min-width:0;min-height:62px;width:100%;padding:9px 16px;border:0;border-top:3px solid #674731;background:#f6e8c9;color:#674731;text-align:left;box-shadow:inset 0 2px #fff8e7}.order-inbox-shortcut.has-reply{background:#e4edcf}.order-inbox-shortcut-icon{position:relative;display:grid;place-items:center;flex:0 0 35px;width:35px;height:35px;border:2px solid #674731;background:#fff6df}.order-inbox-shortcut-icon svg{width:20px;height:20px}.order-inbox-shortcut-count{position:absolute;top:-9px;right:-8px;display:grid;place-items:center;min-width:19px;height:19px;padding:1px 3px;border:2px solid #fff6df;background:#ad513f;color:#fff9e9;font:9px Silkscreen,monospace}.order-inbox-shortcut-copy{display:grid;gap:3px;flex:1;min-width:0}.order-inbox-shortcut-copy strong{font:11px/1.3 Silkscreen,monospace}.order-inbox-shortcut-copy small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:11px/1.3 'Courier New',monospace}.order-inbox-shortcut-action{flex-shrink:0;font:9px/1.3 Silkscreen,monospace;text-align:right}.order-inbox-shortcut:focus-visible{outline:3px solid #617e4d;outline-offset:-5px}
.order-chat-summary{display:block;flex-shrink:0;max-height:116px;overflow:auto}.order-chat-summary summary{display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer;list-style:none;line-height:1.5}.order-chat-summary summary::-webkit-details-marker{display:none}.order-chat-summary summary>span{min-width:0;overflow-wrap:anywhere}.order-chat-summary summary strong{font-family:Silkscreen,monospace;font-weight:400;font-size:10px}.order-chat-summary summary small{flex-shrink:0;color:#674731;font:9px Silkscreen,monospace}.order-chat-summary[open] summary{padding-bottom:8px;border-bottom:1px dashed #b69464}.order-chat-summary>div{display:flex;justify-content:space-between;gap:9px;padding-top:6px}.order-chat-summary>div span:first-child{min-width:0;overflow-wrap:anywhere}
@media(max-width:360px){.order-inbox-shortcut{padding-inline:11px;gap:8px}.order-inbox-shortcut-action{font-size:8px}.order-inbox-shortcut-copy strong{font-size:10px}}
.checkout-confirmation{width:min(420px,calc(100vw - 32px));max-height:calc(100dvh - 32px);padding:0;border:4px solid #674731;border-radius:0;background:#fff3da;color:#493425;box-shadow:6px 6px 0 #34281b;overflow:auto}
.checkout-confirmation::backdrop{background:#332719aa;backdrop-filter:blur(2px)}
.checkout-confirmation-content{display:grid;gap:15px;margin:0;padding:22px}
.checkout-confirmation h2{margin:0;color:#674731;font:16px/1.4 Silkscreen,monospace}
.checkout-confirmation p{margin:0;font:13px/1.6 'Courier New',monospace}
.checkout-confirmation-items{display:grid;gap:9px;max-height:30dvh;overflow-y:auto;padding:13px;border:2px solid #c7a576;background:#f5e8ce}
.checkout-confirmation-items>div,.checkout-confirmation-total{display:flex;justify-content:space-between;align-items:baseline;gap:12px;font:12px/1.5 'Courier New',monospace}
.checkout-confirmation-items span{min-width:0;overflow-wrap:anywhere}.checkout-confirmation-items strong{white-space:nowrap}
.checkout-confirmation-total{padding-top:13px;border-top:2px dashed #b69464;font:12px/1.5 Silkscreen,monospace}
.checkout-confirmation-note{color:#80664d}
.checkout-confirmation-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.checkout-confirmation .btn{min-width:0;min-height:45px;margin:0;padding:8px;border:2px solid #62412b;border-radius:0;background:#98704b;color:#fff4dd;box-shadow:2px 2px 0 #62412b;font:10px/1.4 Silkscreen,monospace;white-space:normal}
.checkout-confirmation .btn.secondary{border-color:#a17b50;background:#eddbb8;color:#674731;box-shadow:2px 2px 0 #a17b50}
.checkout-confirmation .btn:disabled{opacity:.6;cursor:default}.checkout-confirmation .btn:focus-visible{outline:3px solid #617e4d;outline-offset:2px}
@media(max-width:360px){.checkout-confirmation-content{padding:16px}.checkout-confirmation-actions{grid-template-columns:1fr}}
</style>

<style scoped src="../assets/css/pixel-store.css"/>
