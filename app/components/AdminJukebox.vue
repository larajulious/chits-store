<script setup lang="ts">
import type {JukeboxAdminState} from '../../shared/jukebox'
const emit=defineEmits<{'session-expired':[]}>()
const state=ref<JukeboxAdminState|null>(null),selected=ref<string[]>([]),selectionChanged=ref(false)
const busy=ref(''),error=ref(''),success=ref(''),now=ref(Date.now()),expanded=ref(false)
let alive=true,offset=0,sequence=0,timer:ReturnType<typeof setInterval>|undefined
const jukebox=computed(()=>state.value?.state)
const playing=computed(()=>jukebox.value?.enabled?jukebox.value.nowPlaying:null)
const remaining=computed(()=>playing.value?Math.max(0,playing.value.startedAt+playing.value.track.durationMs-now.value):0)
const upNext=computed(()=>jukebox.value?.candidates.find(track=>track.id===jukebox.value?.upNext))
const summary=computed(()=>!state.value?'Loading…':!jukebox.value?.enabled?'Off':playing.value?`♪ ${playing.value.track.title}`:'No playable tracks')
function clock(ms:number){const seconds=Math.floor(ms/1000);return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`}
function apply(next:JukeboxAdminState){
  state.value=next;offset=next.state.serverNow-Date.now();now.value=next.state.serverNow
  if(!selectionChanged.value)selected.value=next.library.filter(track=>track.selected&&track.available).map(track=>track.id)
}
async function refresh(force=false){
  if(!alive||(!force&&busy.value))return
  const current=++sequence
  try{const next=await $fetch<JukeboxAdminState>('/api/admin/jukebox');if(alive&&current===sequence)apply(next)}
  catch(e:any){if(alive&&current===sequence){error.value=e?.data?.statusMessage||'Could not load the jukebox';if(e?.response?.status===401)emit('session-expired')}}
}
async function act(body:{action:'settings'|'skip'|'rescan';enabled?:boolean;votingEnabled?:boolean;trackIds?:string[]},done:string){
  if(busy.value)return
  busy.value=body.action;error.value='';success.value='';++sequence
  try{
    if(body.trackIds)selectionChanged.value=false
    apply(await $fetch<JukeboxAdminState>('/api/admin/jukebox',{method:'POST',body}))
    success.value=done
  }catch(e:any){
    if(body.trackIds)selectionChanged.value=true
    error.value=e?.data?.statusMessage||'Could not update the jukebox';if(e?.response?.status===401)emit('session-expired')
  }finally{busy.value=''}
}
function toggleTrack(id:string,on:boolean){selected.value=on?[...selected.value,id]:selected.value.filter(item=>item!==id);selectionChanged.value=true}
// Poll only while the section is open; the clock ticks locally between polls.
function onToggle(event:Event){
  expanded.value=(event.target as HTMLDetailsElement).open
  clearInterval(timer);timer=undefined
  if(expanded.value){void refresh(true);let ticks=0;timer=setInterval(()=>{now.value=Date.now()+offset;if(++ticks%5===0&&!document.hidden)void refresh()},1000)}
}
onMounted(()=>void refresh(true))
onBeforeUnmount(()=>{alive=false;clearInterval(timer)})
defineExpose({refresh:()=>refresh(true)})
</script>
<template>
  <details class="card admin-jukebox" @toggle="onToggle">
    <summary>Jukebox <span>{{ summary }}</span></summary>
    <div v-if="state&&jukebox" class="admin-jukebox-content">
      <div class="admin-jukebox-toggle"><span>Jukebox: <strong>{{ jukebox.enabled?'On':'Off' }}</strong></span><button type="button" class="btn small secondary" :disabled="!!busy" @click="act({action:'settings',enabled:!jukebox.enabled},jukebox.enabled?'Jukebox turned off for everyone.':'Jukebox turned on.')">{{ jukebox.enabled?'Turn off':'Turn on' }}</button></div>
      <div class="admin-jukebox-toggle"><span>Customer voting: <strong>{{ jukebox.votingEnabled?'On':'Off' }}</strong></span><button type="button" class="btn small secondary" :disabled="!!busy" @click="act({action:'settings',votingEnabled:!jukebox.votingEnabled},jukebox.votingEnabled?'Voting paused. Songs now play in rotation.':'Voting is open.')">{{ jukebox.votingEnabled?'Pause voting':'Allow voting' }}</button></div>
      <article class="admin-jukebox-now">
        <header><strong>Now playing</strong><span v-if="playing">{{ clock(remaining) }} left</span></header>
        <p>{{ playing?playing.track.title:jukebox.enabled?'Nothing is playing. Select a playable track below.':'The jukebox is off.' }}</p>
        <button type="button" class="btn small" :disabled="!!busy||!playing" @click="act({action:'skip'},'Skipped. The next song is starting.')">{{ busy==='skip'?'Skipping…':'Skip track' }}</button>
      </article>
      <article v-if="playing&&jukebox.candidates.length" class="admin-jukebox-votes">
        <header><strong>{{ jukebox.votingEnabled?'Votes this round':'Coming up' }}</strong><span>{{ state.totalVotes }} {{ state.totalVotes===1?'vote':'votes' }}</span></header>
        <ul><li v-for="track in jukebox.candidates" :key="track.id" :class="{leading:track.id===jukebox.upNext}"><span>{{ track.title }}</span><b>{{ jukebox.votes[track.id]??0 }}</b></li></ul>
        <small v-if="upNext">Up next: {{ upNext.title }}{{ state.totalVotes?'':' (no votes yet, so the longest-waiting song plays)' }}</small>
      </article>
      <fieldset class="admin-jukebox-library">
        <legend>Track library</legend>
        <p v-if="state.libraryError" class="error" role="alert">{{ state.libraryError }}</p>
        <p v-if="!state.library.length" class="help-text">No tracks found. Add MP3 files and entries to music/tracks.json, then rescan.</p>
        <label v-for="track in state.library" :key="track.id" :class="{missing:!track.available}">
          <input type="checkbox" :checked="selected.includes(track.id)" :disabled="!track.available||!!busy" @change="toggleTrack(track.id,($event.target as HTMLInputElement).checked)">
          <span><strong>{{ track.title }}</strong><small>{{ track.available?[track.mood,track.durationMs?clock(track.durationMs):''].filter(Boolean).join(' · '):`Unavailable: ${track.reason}` }}</small><small v-if="track.license">{{ track.license }}</small></span>
        </label>
        <div class="admin-jukebox-actions"><button type="button" class="btn small" :disabled="!!busy||!selectionChanged||!selected.length" @click="act({action:'settings',trackIds:selected},'Track selection saved.')">Save selection</button><button type="button" class="btn small secondary" :disabled="!!busy" @click="act({action:'rescan'},'Library rescanned.')">{{ busy==='rescan'?'Scanning…':'Rescan library' }}</button></div>
      </fieldset>
      <p v-if="error" class="error" role="alert">{{ error }}</p><p v-else-if="success" class="success" role="status">{{ success }}</p>
    </div>
    <p v-else-if="error" class="error" role="alert">{{ error }}</p>
  </details>
</template>
<style scoped>
.admin-jukebox{flex-shrink:0!important;padding:14px 18px!important;font-family:'Courier New',monospace;color:#493425}
.admin-jukebox summary{display:list-item;cursor:pointer;font:11px/1.7 Silkscreen,monospace;color:#674731}.admin-jukebox summary>span{float:right;max-width:55%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:10px/1.8 'Courier New',monospace;color:#4b6546}
.admin-jukebox-content{display:grid;gap:12px;padding-top:14px;min-width:0}
.admin-jukebox-toggle{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:11px}
.admin-jukebox article{display:grid;gap:8px;padding:12px;border:2px solid #c7a576;background:#f2e4c9;box-shadow:2px 2px 0 #ddc399;min-width:0}
.admin-jukebox article header{display:flex;justify-content:space-between;gap:8px;font-size:11px;color:#715a43}.admin-jukebox article header strong{font:10px/1.5 Silkscreen,monospace;font-weight:400;color:#674731}
.admin-jukebox article p{margin:0;font-size:13px;line-height:1.5;overflow-wrap:anywhere}.admin-jukebox article .btn{justify-self:start}
.admin-jukebox-votes ul{display:grid;gap:4px;margin:0;padding:0;list-style:none}.admin-jukebox-votes li{display:flex;justify-content:space-between;gap:8px;padding:5px 8px;background:#fff7e5;font-size:12px}.admin-jukebox-votes li.leading{background:#d3e3b1}.admin-jukebox-votes li span{min-width:0;overflow-wrap:anywhere}
.admin-jukebox small{font-size:10px;line-height:1.5;color:#715a43}
.admin-jukebox-library{display:grid;gap:8px;margin:0;padding:12px;border:2px solid #c7a576;min-width:0}.admin-jukebox-library legend{padding:0 6px;font:10px/1.5 Silkscreen,monospace;color:#674731}
.admin-jukebox-library label{display:flex;align-items:flex-start;gap:10px;padding:6px 0;border-top:1px dashed #d9c3a5;cursor:pointer}.admin-jukebox-library label:first-of-type{border-top:0}.admin-jukebox-library label.missing{cursor:default;opacity:.75}
.admin-jukebox-library input{width:18px;height:18px;margin-top:2px;accent-color:#63815b;flex-shrink:0}.admin-jukebox-library label>span{display:grid;gap:2px;min-width:0}.admin-jukebox-library strong{font-size:12px;overflow-wrap:anywhere}.admin-jukebox-library label small{overflow-wrap:anywhere}
.admin-jukebox-actions{display:flex;flex-wrap:wrap;gap:8px;padding-top:4px}
.admin-jukebox p.error,.admin-jukebox p.success,.admin-jukebox .help-text{margin:0;font-size:11px}
.admin-jukebox .btn{border:2px solid #62412b;border-radius:0;background:#98704b;color:#fff4dd;box-shadow:3px 3px 0 #62412b;font:9px/1.5 Silkscreen,monospace;min-height:36px;padding:7px 10px;transition:none}
.admin-jukebox .btn.secondary{border-color:#a17b50;background:#eddbb8;color:#674731;box-shadow:3px 3px 0 #a17b50}
.admin-jukebox .btn:disabled{opacity:1;border-color:#baa68a;background:#e3d4bc;color:#94816a;box-shadow:2px 2px 0 #baa68a}
.admin-jukebox button:focus-visible,.admin-jukebox summary:focus-visible,.admin-jukebox input:focus-visible{outline:3px solid #617e4d;outline-offset:4px}
</style>
