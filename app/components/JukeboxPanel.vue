<script setup lang="ts">
import type {JukeboxMyVote,JukeboxState} from '../../shared/jukebox'
import type {JukeboxListenStatus} from '../utils/jukeboxPlayer'
const props=defineProps<{state:JukeboxState|null;myVote:JukeboxMyVote;pendingVote:string;message:string;status:JukeboxListenStatus;musicOn:boolean;volume:number;volumeAdjustable:boolean;serverNow:number;connected:boolean}>()
const emit=defineEmits<{vote:[trackId:string];toggle:[];volume:[value:number]}>()
const track=computed(()=>props.state?.enabled?props.state.nowPlaying?.track:undefined)
const elapsed=computed(()=>{const now=props.state?.nowPlaying;return now&&track.value?Math.max(0,Math.min(track.value.durationMs,props.serverNow-now.startedAt)):0})
const percent=computed(()=>track.value?Math.round(elapsed.value/track.value.durationMs*1000)/10:0)
const mine=computed(()=>props.myVote&&props.myVote.round===props.state?.round?props.myVote.trackId:'')
const totalVotes=computed(()=>Object.values(props.state?.votes??{}).reduce((sum,count)=>sum+count,0))
const upNext=computed(()=>props.state?.candidates.find(candidate=>candidate.id===props.state?.upNext))
const listening=computed(()=>props.musicOn&&props.status!=='off'&&props.status!=='needs_gesture')
const statusText=computed(()=>({loading:'Tuning in…',playing:'Playing in time with everyone in the store.',waiting:'The next song is about to start…',error:'This song could not load on your device. You will hear the next one.'} as Record<string,string>)[props.status]||'')
const votes=(id:string)=>props.state?.votes[id]??0
const share=(id:string)=>`${totalVotes.value?Math.round(votes(id)/totalVotes.value*100):0}%`
function clock(ms:number){const seconds=Math.floor(ms/1000);return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`}
</script>
<template>
  <div class="jukebox-panel">
    <section class="jukebox-now" aria-label="Now playing">
      <PixelSprite name="jukebox" :scale="2"/>
      <div class="jukebox-now-copy">
        <small>{{ !state?'Tuning in…':!state.enabled?'Jukebox off':track?'Now playing':'Waiting for a song' }}</small>
        <strong>{{ track?.title||'No song playing' }}</strong>
        <span v-if="track&&(track.mood||track.artist)">{{ [track.mood,track.artist].filter(Boolean).join(' · ') }}</span>
      </div>
    </section>
    <div v-if="track" class="jukebox-progress">
      <div class="jukebox-bar" role="progressbar" aria-label="Song progress" :aria-valuemin="0" :aria-valuemax="Math.round(track.durationMs/1000)" :aria-valuenow="Math.round(elapsed/1000)" :aria-valuetext="`${clock(elapsed)} of ${clock(track.durationMs)}`"><span :style="{width:`${percent}%`}"/></div>
      <div class="jukebox-times" aria-hidden="true"><span>{{ clock(elapsed) }}</span><span>{{ clock(track.durationMs) }}</span></div>
    </div>
    <p v-else-if="state&&!state.enabled" class="jukebox-note">Staff have turned the jukebox off for now.</p>
    <p v-else-if="state" class="jukebox-note">No songs are available right now.</p>

    <section class="jukebox-listen" aria-label="Your music">
      <template v-if="!listening">
        <button type="button" class="btn jukebox-enable" data-music-control @click="emit('toggle')"><StoreGlyph name="note"/>{{ musicOn&&status==='needs_gesture'?'Tap to start music':'Enable music' }}</button>
        <p class="jukebox-note">{{ musicOn&&status==='needs_gesture'?'Your browser needs one tap before it can play sound.':'Music stays off until you turn it on. Your volume and mute only affect you.' }}</p>
      </template>
      <template v-else>
        <div class="jukebox-controls">
          <button type="button" class="btn secondary" data-music-control @click="emit('toggle')">Mute</button>
          <label v-if="volumeAdjustable" class="jukebox-volume"><span>Volume</span><input type="range" min="0" max="100" step="5" :value="Math.round(volume*100)" :aria-valuetext="`${Math.round(volume*100)} percent`" data-music-control @input="emit('volume',Number(($event.target as HTMLInputElement).value)/100)"></label>
          <p v-else class="jukebox-note">Use your device's volume buttons.</p>
        </div>
        <p v-if="statusText" class="jukebox-note" role="status">{{ statusText }}</p>
      </template>
    </section>

    <section v-if="state?.enabled&&state.candidates.length" class="jukebox-vote" aria-labelledby="jukebox-vote-title">
      <div class="jukebox-vote-heading"><strong id="jukebox-vote-title">{{ state.votingEnabled?'Vote for the next song':'Coming up' }}</strong><span v-if="upNext">Up next: {{ upNext.title }}</span></div>
      <ul v-if="state.votingEnabled">
        <li v-for="candidate in state.candidates" :key="candidate.id">
          <button type="button" :aria-pressed="mine===candidate.id" :aria-label="`Vote for ${candidate.title}, ${votes(candidate.id)} ${votes(candidate.id)===1?'vote':'votes'}`" :disabled="!connected||!!pendingVote" @click="emit('vote',candidate.id)">
            <span class="jukebox-choice-copy"><strong>{{ mine===candidate.id?'✓ ':'' }}{{ candidate.title }}</strong><small v-if="candidate.mood">{{ candidate.mood }}</small></span>
            <span class="jukebox-choice-votes" aria-hidden="true"><span class="jukebox-choice-bar"><span :style="{width:share(candidate.id)}"/></span><b>{{ votes(candidate.id) }}</b></span>
          </button>
        </li>
      </ul>
      <p class="jukebox-note">{{ !state.votingEnabled?'Song voting is paused by staff.':state.candidates.length===1?'Only one song is in the jukebox right now.':mine?'Vote saved. You can change it until this song ends.':'One vote per visitor each song. Most votes plays next.' }}</p>
    </section>
    <p v-if="message" class="error" role="alert">{{ message }}</p>
  </div>
</template>
<style scoped>
.jukebox-panel{display:grid;gap:14px;min-width:0;font-family:'Courier New',monospace;color:#493425}
.jukebox-now{display:flex;align-items:center;gap:12px;min-width:0}.jukebox-now .pixel-sprite{width:36px;height:auto}
.jukebox-now-copy{display:grid;gap:4px;min-width:0}.jukebox-now-copy small{font:9px/1.3 Silkscreen,monospace;color:#8f7357;text-transform:uppercase}.jukebox-now-copy strong{font:13px/1.35 Silkscreen,monospace;font-weight:400;color:#674731;overflow-wrap:anywhere}.jukebox-now-copy span{font-size:12px;line-height:1.4;color:#7f684f;overflow-wrap:anywhere}
.jukebox-progress{display:grid;gap:5px}.jukebox-bar{height:10px;border:2px solid #a17b50;background:#f2e4c9;box-shadow:inset 2px 2px 0 #e3cfaa}.jukebox-bar span{display:block;height:100%;background:#98704b}
.jukebox-times{display:flex;justify-content:space-between;font:10px/1 Silkscreen,monospace;color:#8f7357}
.jukebox-note{margin:0;font-size:11px;line-height:1.6;color:#7f684f}
.jukebox-listen{display:grid;gap:8px;padding:12px;border:2px solid #c7a576;background:#f5e8ce}
.jukebox-controls{display:flex;align-items:center;gap:12px;min-width:0}.jukebox-controls .btn{flex-shrink:0;min-width:84px}
.jukebox-volume{display:flex;align-items:center;gap:8px;flex:1;min-width:0;font:9px/1 Silkscreen,monospace;color:#674731;text-transform:uppercase}.jukebox-volume input{flex:1;min-width:0;min-height:44px;accent-color:#98704b}
.btn{display:flex;align-items:center;justify-content:center;gap:7px;min-height:44px;margin:0;padding:8px 12px;border:2px solid #62412b;border-radius:0;background:#98704b;color:#fff4dd;box-shadow:2px 2px 0 #62412b,inset 2px 2px 0 #b89067;font:11px/1.2 Silkscreen,monospace;cursor:pointer}
.btn svg{width:16px;height:16px}.btn.secondary{border-color:#a17b50;background:#eddbb8;color:#674731;box-shadow:2px 2px 0 #a17b50,inset 2px 2px 0 #fff7e5}
.btn:active{transform:translate(2px,2px);box-shadow:none}
.jukebox-vote{display:grid;gap:9px;min-width:0}
.jukebox-vote-heading{display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:4px 10px}.jukebox-vote-heading strong{font:11px/1.4 Silkscreen,monospace;font-weight:400;color:#674731}.jukebox-vote-heading span{font-size:11px;color:#7f684f;overflow-wrap:anywhere}
.jukebox-vote ul{display:grid;gap:6px;margin:0;padding:0;list-style:none}
.jukebox-vote li button{display:grid;grid-template-columns:minmax(0,1fr) 76px;align-items:center;gap:10px;width:100%;min-height:48px;padding:7px 10px;border:2px solid #c7a576;background:#fff7e5;color:#674731;text-align:left;cursor:pointer}
.jukebox-vote li button[aria-pressed="true"]{border-color:#674731;background:#e7d2ab}
.jukebox-vote li button:disabled{cursor:default;opacity:.7}
.jukebox-choice-copy{display:grid;gap:3px;min-width:0}.jukebox-choice-copy strong{font:10px/1.4 Silkscreen,monospace;font-weight:400;overflow-wrap:anywhere}.jukebox-choice-copy small{font-size:11px;line-height:1.3;color:#80664d;overflow-wrap:anywhere}
.jukebox-choice-votes{display:flex;align-items:center;gap:6px}.jukebox-choice-bar{flex:1;height:8px;border:1px solid #b08a5e;background:#f2e4c9}.jukebox-choice-bar span{display:block;height:100%;background:#91aa6f}.jukebox-choice-votes b{min-width:16px;text-align:right;font:10px/1 Silkscreen,monospace;font-weight:400}
.error{margin:0;font-size:12px}
button:focus-visible,input:focus-visible{outline:3px solid #617e4d;outline-offset:2px}
@media(max-width:360px){.jukebox-controls{flex-wrap:wrap}.jukebox-vote li button{grid-template-columns:minmax(0,1fr) 60px}}
</style>
