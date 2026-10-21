<script setup lang="ts">
import type {AdminFeedbackState,FeedbackSubmission} from '../../shared/feedback'
const emit=defineEmits<{'session-expired':[]}>()
const state=ref<AdminFeedbackState>({pending:[],published:[],pendingCount:0,now:Date.now()}),tab=ref<'pending'|'published'>('pending')
const error=ref(''),success=ref(''),busyId=ref<number|null>(null),loaded=ref(false)
let alive=true,polling=false,sequence=0,timer:ReturnType<typeof setInterval>|undefined
async function refresh(force=false){
  if(!alive||(!force&&polling)||busyId.value!==null)return
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
defineExpose({refresh:()=>refresh(true)})
</script>
<template>
  <details class="card admin-feedback">
    <summary>Customer feedback <span>{{ loaded?`${state.pendingCount} pending`:'Loading…' }}</span></summary>
    <div class="admin-feedback-content">
      <p>Approve suggestions and reviews for the store. Public visibility lasts 10 hours from approval.</p>
      <nav aria-label="Feedback queues"><button type="button" :aria-pressed="tab==='pending'" @click="tab='pending'">Pending ({{ state.pendingCount }})</button><button type="button" :aria-pressed="tab==='published'" @click="tab='published'">Published</button><button type="button" @click="refresh()">Refresh</button></nav>
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
.admin-feedback{font-family:'Courier New',monospace;color:#493425}
.admin-feedback summary{font:11px/1.7 Silkscreen,monospace;color:#674731}
.admin-feedback summary>span{font:10px/1.8 'Courier New',monospace;color:#4b6546}
.admin-feedback-content>p,.admin-feedback small{color:#715a43}
.admin-feedback nav button{border:2px solid #a17b50;border-radius:0;background:#eddbb8;color:#674731;box-shadow:2px 2px 0 #a17b50;font:9px/1.5 Silkscreen,monospace;min-height:40px}
.admin-feedback nav button[aria-pressed=true]{border-color:#5b754e;background:#d3e3b1;color:#3e5939;box-shadow:2px 2px 0 #91aa6f}
.admin-feedback article{border:2px solid #c7a576;border-radius:0;background:#f2e4c9;box-shadow:2px 2px 0 #ddc399}
.admin-feedback article header strong{font-family:Silkscreen,monospace;font-size:10px;font-weight:400;color:#674731}
.admin-feedback article p{color:#493425}
.admin-feedback .btn{border:2px solid #62412b;border-radius:0;background:#98704b;color:#fff4dd;box-shadow:3px 3px 0 #62412b;font:9px/1.5 Silkscreen,monospace;transition:none}
.admin-feedback .btn.green{border-color:#486b49;background:#63815b;box-shadow:3px 3px 0 #486b49}
.admin-feedback .btn.secondary{border-color:#a17b50;background:#eddbb8;color:#674731;box-shadow:3px 3px 0 #a17b50}
.admin-feedback .btn:disabled{opacity:1;border-color:#baa68a;background:#e3d4bc;color:#94816a;box-shadow:2px 2px 0 #baa68a}
.admin-feedback button:focus-visible,.admin-feedback summary:focus-visible{outline:3px solid #617e4d;outline-offset:4px}
</style>
