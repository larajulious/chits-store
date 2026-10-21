<script setup lang="ts">
import type {AdminChatState,ChatMessage} from '../../shared/chat'
const emit=defineEmits<{'session-expired':[]}>()
const messages=ref<ChatMessage[]>([]),draft=ref(''),connected=ref(false),chatEnabled=ref(true),online=ref(0),sending=ref(false),error=ref('')
const feed=ref<HTMLElement|null>(null)
let alive=true,polling=false,requestSequence=0,timer:ReturnType<typeof setInterval>|undefined
async function apply(state:AdminChatState,scrollToBottom=false){
  const el=feed.value
  const nearBottom=!el||el.scrollHeight-el.scrollTop-el.clientHeight<48
  const changed=messages.value.at(-1)?.messageId!==state.messages.at(-1)?.messageId
  messages.value=state.messages;chatEnabled.value=state.chatEnabled;online.value=state.online;connected.value=true
  if(scrollToBottom||(changed&&nearBottom)){
    await nextTick()
    if(alive&&feed.value)feed.value.scrollTop=feed.value.scrollHeight
  }
}
async function load(){
  if(!alive||polling||sending.value)return
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
  if(sending.value||!connected.value||!chatEnabled.value||!text||text.length>160)return
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
</script>
<template>
  <section class="card stack admin-chat" aria-labelledby="admin-chat-title">
    <header class="admin-chat-header"><h2 id="admin-chat-title" class="section-head"><StoreGlyph name="chat"/>Customer chat</h2><span class="pill" :class="{ready:connected}">{{ connected?`${online} online`:'Connecting…' }}</span></header>
    <p class="help-text chat-explanation">Reply as staff to everyone in the store.</p>
    <div ref="feed" class="admin-chat-feed" role="log" aria-label="Community chat messages" aria-live="polite" aria-relevant="additions text">
      <p v-if="messages.length===0" class="help-text">No messages yet. Say hello to your visitors.</p>
      <div v-for="entry in messages" :key="entry.messageId" class="admin-chat-line" :class="{'from-staff':entry.role==='staff'}"><div class="chat-sender"><strong>{{ entry.nickname }}</strong><span v-if="entry.role==='staff'" class="staff-tag">STAFF</span><time :datetime="new Date(entry.at).toISOString()">{{ new Date(entry.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) }}</time></div><p>{{ entry.text }}</p></div>
    </div>
    <p v-if="!connected" class="help-text" role="status">Connecting to chat. Retrying automatically.</p>
    <p v-else-if="!chatEnabled" class="help-text" role="status">Public chat is paused. Enable it in Community Moderation to send and receive replies.</p>
    <form class="admin-chat-form" @submit.prevent="send"><label for="staff-message" class="label">Message customers</label><div><input id="staff-message" v-model="draft" class="input" maxlength="160" placeholder="Say hello or answer a question…" autocomplete="off" :disabled="sending"><button type="submit" class="btn small" :disabled="sending||!connected||!chatEnabled||!draft.trim()">{{ sending?'Sending…':'Send' }}</button></div><span class="help-text">{{ draft.length }}/160 · Public room</span></form>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p class="privacy">Public chat. Messages clear on restart; avoid personal details.</p>
  </section>
</template>
<style scoped>
.admin-chat{min-width:0}.admin-chat-header{display:flex;align-items:center;justify-content:space-between;gap:12px}.admin-chat-header h2{display:flex;align-items:center;gap:8px;margin:0}.admin-chat-header .pill{flex-shrink:0}.chat-explanation{margin:0;line-height:1.6}
.admin-chat-feed{min-width:0;height:280px;overflow:auto;overscroll-behavior:contain;display:flex;flex-direction:column;gap:10px;padding:12px;background:#f6ead5;border:1px solid #d9bf9e;border-radius:12px}.admin-chat-feed>p{margin:0;line-height:1.6}.admin-chat-line{min-width:0;padding:10px;background:#fff9ee;border:1px solid #e4cfb2;border-radius:8px}.admin-chat-line.from-staff{background:#eef2df;border-color:#c5d2aa}.chat-sender{display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:12px;color:#755039}.chat-sender time{margin-left:auto;font-size:10px;color:#8d745a}.staff-tag{font-size:9px;font-weight:800;letter-spacing:.05em;color:#4c6a42;background:#d8e6bd;padding:3px 5px}.admin-chat-line p{margin:5px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;line-height:1.6}
.admin-chat-form{display:grid;gap:8px;min-width:0}.admin-chat-form>div{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:stretch}.admin-chat-form .input{min-width:0;font-size:13px}.admin-chat-form .btn{min-width:66px;min-height:44px}.admin-chat .privacy,.admin-chat .error{margin:0}
@media(max-width:420px){.admin-chat-header h2{font-size:15px}.admin-chat-header .pill{font-size:10px}.admin-chat-feed{padding:8px}.chat-sender{font-size:11px}}
</style>
