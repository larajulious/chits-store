<script setup lang="ts">
import {FEEDBACK_MAX_LENGTH,type FeedbackKind,type FeedbackPost,type PublicFeedbackState} from '../../shared/feedback'
const kind=ref<FeedbackKind>('suggestion'),draft=ref(''),sending=ref(false),loading=ref(true),error=ref(''),success=ref('')
const posts=ref<FeedbackPost[]>([]),now=ref(Date.now()),refreshing=ref(false),loadError=ref('')
let alive=true,refreshAgain=false,offset=0,timer:ReturnType<typeof setInterval>|undefined,clock:ReturnType<typeof setInterval>|undefined
const visiblePosts=computed(()=>posts.value.filter(post=>post.expiresAt>now.value))
async function refresh(){
  if(!alive)return
  if(refreshing.value){refreshAgain=true;return}
  refreshing.value=true
  try{
    const state=await $fetch<PublicFeedbackState>('/api/feedback')
    if(alive){posts.value=state.posts;offset=state.now-Date.now();now.value=state.now;loadError.value=''}
  }catch(e:any){if(alive)loadError.value=e?.data?.statusMessage||'Could not load the feedback board. Please try again.'}
  finally{refreshing.value=false;if(alive)loading.value=false;if(refreshAgain&&alive){refreshAgain=false;void refresh()}}
}
async function submit(){
  if(sending.value||!draft.value.trim())return
  sending.value=true;error.value='';success.value=''
  try{
    await $fetch('/api/feedback',{method:'POST',body:{kind:kind.value,text:draft.value.trim()}})
    if(alive){draft.value='';success.value='Thank you for sharing your feedback!'}
  }catch(e:any){if(alive)error.value=e?.data?.statusMessage||'Could not send your feedback. Your message is still here.'}
  finally{if(alive)sending.value=false}
}
function remaining(post:FeedbackPost){const minutes=Math.max(1,Math.ceil((post.expiresAt-now.value)/60_000));return minutes>=60?`${Math.floor(minutes/60)}h ${minutes%60}m`:`${minutes}m`}
onMounted(()=>{void refresh();timer=setInterval(()=>void refresh(),30_000);clock=setInterval(()=>{now.value=Date.now()+offset},1000)})
onBeforeUnmount(()=>{alive=false;clearInterval(timer);clearInterval(clock)})
defineExpose({refresh})
</script>
<template>
  <div class="feedback-box">
    <p class="feedback-intro">Share a suggestion or review. Posts on the community board are visible for <strong>10 hours</strong>.</p>
    <form class="feedback-form" @submit.prevent="submit">
      <label class="label" for="feedback-kind">Post type</label>
      <select id="feedback-kind" v-model="kind" :disabled="sending"><option value="suggestion">Suggestion</option><option value="review">Review</option></select>
      <label class="label" for="feedback-text">Your feedback</label>
      <textarea id="feedback-text" v-model="draft" rows="3" :maxlength="FEEDBACK_MAX_LENGTH" :disabled="sending" placeholder="What would make your next visit even better?" required/>
      <div class="feedback-form-note"><span>Please leave out personal details.</span><span>{{ draft.length }}/{{ FEEDBACK_MAX_LENGTH }}</span></div>
      <button class="btn dialog-action" type="submit" :disabled="sending||!draft.trim()">{{ sending?'Sending…':'Send feedback' }}</button>
    </form>
    <p v-if="success" class="feedback-success" role="status">{{ success }}</p>
    <p v-if="error||loadError" class="feedback-error" role="alert">{{ error||loadError }}</p>
    <section class="feedback-public" aria-labelledby="approved-feedback-heading">
      <header><h3 id="approved-feedback-heading">Community board</h3><button type="button" class="feedback-refresh" :disabled="refreshing" @click="refresh">Refresh</button></header>
      <p v-if="loading">Loading community posts…</p>
      <p v-else-if="!visiblePosts.length" class="feedback-empty">No posts yet. We’d love to hear from you!</p>
      <article v-for="post in visiblePosts" :key="post.id" class="feedback-post">
        <header><span class="feedback-kind">{{ post.kind==='suggestion'?'Suggestion':'Review' }}</span><span>Visible for {{ remaining(post) }}</span></header>
        <p>{{ post.text }}</p><small>{{ post.nickname }}</small>
      </article>
    </section>
  </div>
</template>
<style scoped>
.feedback-box{display:grid;gap:16px;min-width:0;font-family:'Courier New',monospace}.feedback-intro{margin:0;font-size:13px;line-height:1.6;color:#755b44}.feedback-form{display:grid;gap:8px;min-width:0}.feedback-form select,.feedback-form textarea{width:100%;min-width:0;max-width:100%;border:2px solid #b08a5e;border-radius:0;background:#fffbef;box-shadow:inset 2px 2px 0 #ead9ba;padding:10px;color:#493425;font:14px/1.5 'Courier New',monospace}.feedback-form textarea{resize:vertical;min-height:95px;max-height:220px}.feedback-form select:focus-visible,.feedback-form textarea:focus-visible{outline:3px solid #617e4d;outline-offset:2px}.feedback-form .btn{border:2px solid #62412b;border-radius:0;background:#98704b;color:#fff4dd;box-shadow:2px 2px 0 #62412b,inset 2px 2px 0 #b89067;font:11px/1.5 Silkscreen,monospace;min-height:44px;padding:12px}.feedback-form .btn:disabled{opacity:1;background:#e3d4bc;color:#94816a;border-color:#baa68a;box-shadow:2px 2px 0 #baa68a}.feedback-form .btn:focus-visible{outline:3px solid #617e4d;outline-offset:4px}.feedback-form-note{display:flex;justify-content:space-between;gap:8px;font-size:10px;line-height:1.5;color:#7f684f}.feedback-success,.feedback-error{padding:10px;margin:0;border:2px solid #91aa6f;background:#e6edce;color:#3e5939;font-size:13px;line-height:1.6}.feedback-error{border-color:#c18c78;background:#f8dfd0;color:#8e4330}.feedback-public{display:grid;gap:12px;border-top:2px solid #d4b68a;padding-top:14px}.feedback-public>header,.feedback-post>header{display:flex;align-items:center;justify-content:space-between;gap:8px}.feedback-public h3{margin:0;font:12px/1.6 Silkscreen,monospace}.feedback-refresh{background:transparent;border:0;text-decoration:underline;color:#755b44;font:12px 'Courier New',monospace;min-height:36px}.feedback-empty,.feedback-public>p{margin:0;font-size:13px;line-height:1.6;color:#7d654c}.feedback-post{min-width:0;border:2px solid #c7a576;background:#f2e4c9;padding:12px}.feedback-post>header{font-size:10px;color:#7d654c;flex-wrap:wrap}.feedback-kind{font:9px Silkscreen,monospace;color:#674731}.feedback-post p{font-size:14px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere;margin:10px 0}.feedback-post small{font-size:10px;color:#806649;overflow-wrap:anywhere}
</style>
