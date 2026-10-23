<script setup lang="ts">
import type {AdminChatState,ChatMessage} from '../../shared/chat'
import {playChatSound} from '../utils/chatSound'
const props=defineProps<{storeOpen:boolean}>()
const emit=defineEmits<{'session-expired':[]}>()
const messages=ref<ChatMessage[]>([]),draft=ref(''),connected=ref(false),chatEnabled=ref(true),online=ref(0),sending=ref(false),error=ref(''),unread=ref(0)
const feed=ref<HTMLElement|null>(null),root=ref<HTMLElement|null>(null)
let alive=true,polling=false,requestSequence=0,initialized=false,timer:ReturnType<typeof setInterval>|undefined
function clearUnread(){unread.value=0}
function readChat(){clearUnread();if(feed.value){feed.value.scrollTop=feed.value.scrollHeight;feed.value.focus()}}
function chatFocused(){return document.visibilityState==='visible'&&!!document.activeElement&&!!root.value?.contains(document.activeElement)}
async function apply(state:AdminChatState,scrollToBottom=false){
  const el=feed.value
  const nearBottom=!el||el.scrollHeight-el.scrollTop-el.clientHeight<48
  const changed=messages.value.at(-1)?.messageId!==state.messages.at(-1)?.messageId
  const previous=new Set(messages.value.map(message=>message.messageId))
  const incoming=initialized?state.messages.filter(message=>message.role==='visitor'&&!previous.has(message.messageId)):[]
  initialized=true
  messages.value=state.messages;chatEnabled.value=state.chatEnabled;online.value=state.online;connected.value=true
  if(!state.messages.length)clearUnread()
  else if(incoming.length){
    if(!document.hidden)playChatSound()
    if(!chatFocused())unread.value=Math.min(99,unread.value+incoming.length)
  }
  if(scrollToBottom||(changed&&nearBottom)){
    await nextTick()
    if(alive&&feed.value)feed.value.scrollTop=feed.value.scrollHeight
  }
}
async function load(force=false){
  if(!alive||(!force&&polling)||sending.value)return
  polling=true
  const sequence=++requestSequence
  try{
    const state=await $fetch<AdminChatState>('/api/admin/chat')
    if(alive&&sequence===requestSequence)await apply(state)
  }catch(e:any){
    if(alive&&sequence===requestSequence){connected.value=false;if(e?.response?.status===401)emit('session-expired')}
  }finally{polling=false}
}
async function send(){
  const text=draft.value.trim()
  if(sending.value||!connected.value||!chatEnabled.value||!props.storeOpen||!text||text.length>160)return
  sending.value=true;error.value='';++requestSequence
  try{
    const state=await $fetch<AdminChatState>('/api/admin/chat',{method:'POST',body:{text}})
    if(alive){draft.value='';await apply(state,true)}
  }catch(e:any){
    if(alive){error.value=e?.data?.statusMessage||'Could not send. Your message is still here.';if(e?.response?.status===401)emit('session-expired')}
  }finally{sending.value=false}
}
onMounted(()=>{void load();timer=setInterval(()=>void load(),2000)})
onBeforeUnmount(()=>{alive=false;clearInterval(timer)})
defineExpose({refresh:()=>load(true)})
</script>
<template>
  <section ref="root" class="card stack admin-chat" aria-labelledby="admin-chat-title" @pointerdown="clearUnread" @focusin="clearUnread">
    <header class="admin-chat-header"><h2 id="admin-chat-title" class="section-head"><button type="button" class="admin-chat-icon-button" :aria-label="unread?`Read ${unread} unread customer ${unread===1?'message':'messages'}`:'Focus customer chat'" @click="readChat"><StoreGlyph name="chat"/><span v-if="unread" class="admin-chat-unread-badge" aria-hidden="true">{{ unread>9?'9+':unread }}</span></button>Customer chat</h2><span class="pill" :class="{ready:connected}">{{ connected?`${online} online`:'Connecting…' }}</span></header>
    <p class="help-text chat-explanation">Reply as staff to everyone in the store.</p>
    <div ref="feed" class="admin-chat-feed" role="log" tabindex="0" aria-label="Community chat messages" aria-live="polite" aria-relevant="additions text">
      <p v-if="messages.length===0" class="help-text">No messages yet. Say hello to your visitors.</p>
      <div v-for="entry in messages" :key="entry.messageId" class="admin-chat-line" :class="{'from-staff':entry.role==='staff'}"><div class="chat-sender"><strong>{{ entry.nickname }}</strong><span v-if="entry.role==='staff'" class="staff-tag">STAFF</span><span v-if="entry.reports" class="report-tag" :title="`Reported by ${entry.reports} ${entry.reports===1?'visitor':'visitors'}. Mute or kick them in Community Moderation.`">⚑ {{ entry.reports }} {{ entry.reports===1?'REPORT':'REPORTS' }}</span><time :datetime="new Date(entry.at).toISOString()">{{ new Date(entry.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) }}</time></div><p>{{ entry.text }}</p></div>
    </div>
    <p v-if="!connected" class="help-text" role="status">Connecting to chat. Retrying automatically.</p>
    <p v-else-if="!storeOpen" class="help-text" role="status">The store is closed. Open it to chat with visitors.</p>
    <p v-else-if="!chatEnabled" class="help-text" role="status">Public chat is paused. Enable it in Community Moderation to send and receive replies.</p>
    <form class="admin-chat-form" @submit.prevent="send"><label for="staff-message" class="label">Message customers</label><div><input id="staff-message" v-model="draft" class="input" maxlength="160" placeholder="Say hello or answer a question…" autocomplete="off" :disabled="sending||!storeOpen"><button type="submit" class="btn small" :disabled="sending||!connected||!chatEnabled||!storeOpen||!draft.trim()">{{ sending?'Sending…':'Send' }}</button></div><span class="help-text">{{ draft.length }}/160 · Public room</span></form>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p class="privacy">Public chat. Messages clear on restart; avoid personal details.</p>
  </section>
</template>
<style scoped>
.admin-chat{min-width:0}.admin-chat-header{display:flex;align-items:center;justify-content:space-between;gap:12px}.admin-chat-header h2{display:flex;align-items:center;gap:8px;margin:0}.admin-chat-header .pill{flex-shrink:0}.chat-explanation{margin:0;line-height:1.6}
.admin-chat-feed{min-width:0;height:280px;overflow:auto;overscroll-behavior:contain;display:flex;flex-direction:column;gap:10px;padding:12px;background:#f6ead5;border:1px solid #d9bf9e;border-radius:12px}.admin-chat-feed>p{margin:0;line-height:1.6}.admin-chat-line{min-width:0;padding:10px;background:#fff9ee;border:1px solid #e4cfb2;border-radius:8px}.admin-chat-line.from-staff{background:#eef2df;border-color:#c5d2aa}.chat-sender{display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:12px;color:#755039}.chat-sender time{margin-left:auto;font-size:10px;color:#8d745a}.staff-tag{font-size:9px;font-weight:800;letter-spacing:.05em;color:#4c6a42;background:#d8e6bd;padding:3px 5px}.admin-chat-line p{margin:5px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;line-height:1.6}
.admin-chat-form{display:grid;gap:8px;min-width:0}.admin-chat-form>div{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:stretch}.admin-chat-form .input{min-width:0;font-size:13px}.admin-chat-form .btn{min-width:66px;min-height:44px}.admin-chat .privacy,.admin-chat .error{margin:0}
@media(max-width:420px){.admin-chat-header h2{font-size:15px}.admin-chat-header .pill{font-size:10px}.admin-chat-feed{padding:8px}.chat-sender{font-size:11px}}
.admin-chat{font-family:'Courier New',monospace;color:#493425}
.admin-chat-header h2{font:15px/1.5 Silkscreen,monospace;color:#674731;gap:11px}
.admin-chat-icon-button{position:relative;display:grid;place-items:center;flex-shrink:0;width:30px;height:26px;padding:0;border:0;background:transparent;color:inherit;cursor:pointer}.admin-chat-icon-button svg{width:20px;height:20px}.admin-chat-unread-badge{position:absolute;top:-7px;right:-4px;display:grid;place-items:center;min-width:18px;height:18px;padding:0 2px;border:2px solid #fff3da;background:#ad513f;color:#fff8df;box-shadow:2px 2px 0 #674731;font:8px/1 Silkscreen,monospace;pointer-events:none}
.admin-chat-header .pill{border:1px solid #91aa6f;border-radius:0;background:#d3e3b1;color:#3e5939;font:9px/1.5 Silkscreen,monospace}
.chat-explanation,.admin-chat .privacy{color:#7f684f}
.admin-chat-feed{border:2px solid #c5a678;border-radius:0;background:#f2e4c9;box-shadow:inset 2px 2px 0 #e3cfaa}
.admin-chat-line{border:2px solid #c7a576;border-radius:0;background:#fff7e5;box-shadow:2px 2px 0 #ddc399}
.admin-chat-line.from-staff{border-color:#91aa6f;background:#e6edce;box-shadow:2px 2px 0 #bdcea2}
.chat-sender{color:#715236}.chat-sender strong{font-family:Silkscreen,monospace;font-size:9px;font-weight:400}.chat-sender time{color:#715a43}
.staff-tag{border:1px solid #91aa6f;background:#d3e3b1;color:#3e5939;font:8px/1.5 Silkscreen,monospace}
.report-tag{padding:3px 5px;border:1px solid #c98a7c;background:#f6d6cf;color:#8e3b2c;font:8px/1.5 Silkscreen,monospace}
.admin-chat-form .input{border:2px solid #b08a5e;border-radius:0;background:#fffbef;box-shadow:inset 2px 2px 0 #ead9ba;font-family:'Courier New',monospace}
.admin-chat-form .help-text{color:#755b44}
.admin-chat .btn{border:2px solid #62412b;border-radius:0;background:#98704b;color:#fff4dd;box-shadow:3px 3px 0 #62412b,inset 2px 2px 0 #b89067;font:10px/1.5 Silkscreen,monospace;transition:none}
.admin-chat .btn:disabled{opacity:1;border-color:#baa68a;background:#e3d4bc;color:#94816a;box-shadow:2px 2px 0 #baa68a}
.admin-chat .btn:focus-visible,.admin-chat .input:focus-visible,.admin-chat-icon-button:focus-visible,.admin-chat-feed:focus-visible{outline:3px solid #617e4d;outline-offset:4px}
</style>
