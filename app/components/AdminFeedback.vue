<script setup lang="ts">
import type {AdminFeedbackState,FeedbackSubmission} from '../../shared/feedback'
const emit=defineEmits<{'session-expired':[]}>()
const state=ref<AdminFeedbackState>({pending:[],published:[],pendingCount:0,now:Date.now()}),tab=ref<'pending'|'published'>('pending')
const error=ref(''),success=ref(''),busyId=ref<number|null>(null),loaded=ref(false)
let alive=true,polling=false,sequence=0,timer:ReturnType<typeof setInterval>|undefined
async function refresh(){
  if(!alive||polling||busyId.value!==null)return
  polling=true;const current=++sequence
  try{const result=await $fetch<AdminFeedbackState>('/api/admin/feedback');if(alive&&current===sequence){state.value=result;loaded.value=true}}
  catch(e:any){if(alive&&current===sequence){error.value=e?.data?.statusMessage||'Could not load feedback';if(e?.response?.status===401)emit('session-expired')}}
  finally{polling=false}
}
async function moderate(post:FeedbackSubmission,action:'approve'|'reject'){
  if(busyId.value!==null)return
  busyId.value=post.id;error.value='';success.value='';++sequence
  try{
    const result=await $fetch<AdminFeedbackState>(`/api/admin/feedback/${post.id}`,{method:'PATCH',body:{action}})
    if(alive){state.value=result;success.value=action==='approve'?'Published for 10 hours.':post.status==='approved'?'Post hidden from the store.':'Submission rejected.'}
  }catch(e:any){if(alive){error.value=e?.data?.statusMessage||'Could not update feedback';if(e?.response?.status===401)emit('session-expired')}}
  finally{if(alive)busyId.value=null}
}
onMounted(()=>{void refresh();timer=setInterval(()=>void refresh(),15_000)})
onBeforeUnmount(()=>{alive=false;clearInterval(timer)})
</script>
<template>
  <details class="card admin-feedback">
    <summary>Customer feedback <span>{{ loaded?`${state.pendingCount} pending`:'Loading…' }}</span></summary>
    <div class="admin-feedback-content">
      <p>Approve suggestions and reviews for the store. Public visibility lasts 10 hours from approval.</p>
      <nav aria-label="Feedback queues"><button type="button" :aria-pressed="tab==='pending'" @click="tab='pending'">Pending ({{ state.pendingCount }})</button><button type="button" :aria-pressed="tab==='published'" @click="tab='published'">Published</button><button type="button" @click="refresh">Refresh</button></nav>
      <p v-if="error" class="error" role="alert">{{ error }}</p><p v-if="success" class="success" role="status">{{ success }}</p>
      <p v-if="loaded&&!state[tab].length">{{ tab==='pending'?'No submissions waiting for review.':'No posts currently published.' }}</p>
      <div class="admin-feedback-list">
        <article v-for="post in state[tab]" :key="post.id">
          <header><strong>{{ post.kind==='suggestion'?'Suggestion':'Review' }}</strong><span>{{ post.nickname }}</span></header><p>{{ post.text }}</p>
          <small>{{ tab==='pending'?`Submitted ${new Date(post.createdAt).toLocaleString()}`:`Visible until ${new Date(post.expiresAt!).toLocaleString()}` }}</small>
          <div class="admin-feedback-actions"><button v-if="tab==='pending'" type="button" class="btn small green" :disabled="busyId!==null" :aria-label="`Approve feedback ${post.id}`" @click="moderate(post,'approve')">Approve</button><button type="button" class="btn small secondary" :disabled="busyId!==null" :aria-label="`${tab==='pending'?'Reject':'Hide'} feedback ${post.id}`" @click="moderate(post,'reject')">{{ tab==='pending'?'Reject':'Hide post' }}</button></div>
        </article>
      </div>
      <small>Showing up to 50 posts per queue. Pending posts are private.</small>
    </div>
  </details>
</template>
<style scoped>
.admin-feedback{flex-shrink:0!important;padding:14px 18px!important}.admin-feedback summary{display:list-item;cursor:pointer;font-size:12px;font-weight:750;color:#8f7355}.admin-feedback summary>span{float:right;font-size:10px;color:#7b855d}.admin-feedback-content{display:grid;gap:12px;padding-top:14px;min-width:0}.admin-feedback-content>p{margin:0;font-size:12px;line-height:1.6;color:#8d765e}.admin-feedback nav{display:flex;gap:8px;flex-wrap:wrap}.admin-feedback nav button{border:1px solid #d9c3a5;border-radius:6px;padding:8px;background:#f9f0e0;color:#805d3d;font-size:11px;min-height:36px}.admin-feedback nav button[aria-pressed=true]{background:#e8edda;border-color:#91aa6f;color:#4c6840}.admin-feedback-list{max-height:340px;overflow:auto;display:grid;gap:12px}.admin-feedback article{border:1px solid #dfd0bc;border-radius:8px;padding:12px;min-width:0;background:#fffaf1}.admin-feedback article header{display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap;font-size:11px;color:#8d765e}.admin-feedback article p{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;line-height:1.6;margin:10px 0;color:#493729}.admin-feedback small{font-size:10px;line-height:1.5;color:#9b8165}.admin-feedback-actions{display:flex;gap:8px;margin-top:12px}.admin-feedback .admin-feedback-actions .btn{font-size:11px;padding:8px 12px;min-height:36px}.admin-feedback button:focus-visible{outline:3px solid #69875a;outline-offset:3px}
</style>
