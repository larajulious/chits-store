<script setup lang="ts">
import {cafeMoods,type CafeJukeboxState,type CafeJukeboxVote,type CafeMood} from '../../shared/cafe'
import type {CafeMusicStatus} from '../utils/cafeMusic'
// The café jukebox: one shared set at a time, like the store's jukebox. Votes pick the next mood; listening and
// volume only affect this visitor.
const props=defineProps<{state:CafeJukeboxState|null;myVote:CafeJukeboxVote;pendingVote:string;message:string;status:CafeMusicStatus;musicOn:boolean;volume:number;serverNow:number;connected:boolean}>()
const emit=defineEmits<{vote:[mood:CafeMood];toggle:[];volume:[value:number]}>()
const label=(id:CafeMood|undefined)=>cafeMoods.find(mood=>mood.id===id)?.label??''
const now=computed(()=>cafeMoods.find(mood=>mood.id===props.state?.mood))
const length=computed(()=>props.state?props.state.endsAt-props.state.startedAt:0)
const elapsed=computed(()=>props.state?Math.max(0,Math.min(length.value,props.serverNow-props.state.startedAt)):0)
const percent=computed(()=>length.value?Math.round(elapsed.value/length.value*1000)/10:0)
const mine=computed(()=>props.myVote&&props.myVote.round===props.state?.round?props.myVote.mood:'')
const votes=(id:CafeMood)=>props.state?.votes[id]??0
const totalVotes=computed(()=>cafeMoods.reduce((sum,mood)=>sum+votes(mood.id),0))
const share=(id:CafeMood)=>`${totalVotes.value?Math.round(votes(id)/totalVotes.value*100):0}%`
const listening=computed(()=>props.musicOn&&props.status==='playing')
function clock(ms:number){const seconds=Math.floor(ms/1000);return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`}
</script>
<template>
  <div class="cafe-jukebox">
    <section class="cafe-jukebox-now" aria-label="Now playing">
      <PixelSprite name="jukebox" :scale="2"/>
      <div><small>{{ state?'Now playing in the café':'Tuning in…' }}</small><strong>{{ now?.label||'…' }}</strong><span v-if="now">{{ now.note }}</span></div>
    </section>
    <div v-if="state" class="cafe-progress">
      <div class="cafe-bar" role="progressbar" aria-label="Set progress" :aria-valuemin="0" :aria-valuemax="Math.round(length/1000)" :aria-valuenow="Math.round(elapsed/1000)" :aria-valuetext="`${clock(elapsed)} of ${clock(length)}`"><span :style="{width:`${percent}%`}"/></div>
      <div class="cafe-times" aria-hidden="true"><span>{{ clock(elapsed) }}</span><span>{{ clock(length) }}</span></div>
    </div>

    <section class="cafe-listen" aria-label="Your music">
      <template v-if="!listening">
        <button type="button" class="btn cafe-enable" data-music-control @click="emit('toggle')"><StoreGlyph name="note"/>{{ musicOn&&status==='blocked'?'Tap to start music':'Listen' }}</button>
        <p class="cafe-note">{{ musicOn&&status==='blocked'?'Your browser needs one tap before it can play sound.':'Music stays off until you turn it on. Your volume and mute only affect you.' }}</p>
      </template>
      <template v-else>
        <div class="cafe-controls">
          <button type="button" class="btn secondary" data-music-control @click="emit('toggle')">Mute</button>
          <label class="cafe-volume"><span>Volume</span><input type="range" min="0" max="100" step="5" :value="Math.round(volume*100)" :aria-valuetext="`${Math.round(volume*100)} percent`" data-music-control @input="emit('volume',Number(($event.target as HTMLInputElement).value)/100)"></label>
        </div>
        <p class="cafe-note" role="status">Playing in time with everyone in the café.</p>
      </template>
    </section>

    <section v-if="state" class="cafe-vote" aria-labelledby="cafe-vote-title">
      <div class="cafe-vote-heading"><strong id="cafe-vote-title">Vote for the next mood</strong><span>Up next: {{ label(state.upNext) }}</span></div>
      <ul>
        <li v-for="option in cafeMoods" :key="option.id">
          <button type="button" :aria-pressed="mine===option.id" :aria-label="`Vote for ${option.label}, ${votes(option.id)} ${votes(option.id)===1?'vote':'votes'}`" :disabled="!connected||!!pendingVote" @click="emit('vote',option.id)">
            <span class="cafe-choice-copy"><strong>{{ mine===option.id?'✓ ':'' }}{{ option.label }}</strong><small>{{ option.id===state.mood?'Playing now · vote to keep it':option.note }}</small></span>
            <span class="cafe-choice-votes" aria-hidden="true"><span class="cafe-choice-bar"><span :style="{width:share(option.id)}"/></span><b>{{ votes(option.id) }}</b></span>
          </button>
        </li>
      </ul>
      <p v-if="message" class="cafe-note" role="alert">{{ message }}</p>
      <p class="cafe-note">{{ mine?'Vote saved. You can change it until this set ends.':'One vote per visitor each set. Most votes plays next; with no votes the moods take turns.' }}</p>
    </section>
    <p class="cafe-note">Original music, made on each listener's device in time with the café. The rainy mood brings rain to the deck for everyone here.</p>
  </div>
</template>
<style scoped>
.cafe-jukebox{display:grid;gap:12px;min-width:0;font-family:'Courier New',monospace;color:#493425}
.cafe-jukebox-now{display:flex;align-items:center;gap:12px;min-width:0}.cafe-jukebox-now .pixel-sprite{width:36px;height:auto}
.cafe-jukebox-now div{display:grid;gap:4px;min-width:0}.cafe-jukebox-now small{font:9px/1.3 Silkscreen,monospace;color:#8f7357;text-transform:uppercase}.cafe-jukebox-now strong{font:13px/1.35 Silkscreen,monospace;font-weight:400;color:#674731}.cafe-jukebox-now span{font-size:11px;color:#80664d}
.cafe-progress{display:grid;gap:4px}.cafe-bar{height:8px;border:2px solid #8a6446;background:#fff7e5}.cafe-bar span{display:block;height:100%;background:#5f7f5c}
.cafe-times{display:flex;justify-content:space-between;font:9px/1 Silkscreen,monospace;color:#8f7357}
.cafe-listen{display:grid;gap:6px}.cafe-enable{justify-self:start;display:inline-flex;align-items:center;gap:6px}
.cafe-controls{display:flex;align-items:center;gap:10px;min-width:0}
.cafe-volume{display:flex;flex:1;align-items:center;gap:8px;min-width:0;font:9px/1 Silkscreen,monospace;color:#674731;text-transform:uppercase}.cafe-volume input{flex:1;min-width:0;min-height:44px;accent-color:#5f7f5c}
.cafe-vote{display:grid;gap:8px}.cafe-vote-heading{display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 10px;font:10px/1.4 Silkscreen,monospace;color:#674731}.cafe-vote-heading strong{font-weight:400}.cafe-vote-heading span{color:#80664d}
.cafe-vote ul{display:grid;gap:6px;margin:0;padding:0;list-style:none}
.cafe-vote button{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;min-height:48px;padding:7px 10px;border:2px solid #c7a576;background:#fff7e5;color:#674731;text-align:left;cursor:pointer}
.cafe-vote button[aria-pressed="true"]{border-color:#3f5a45;background:#e6edce}.cafe-vote button:disabled{cursor:default;opacity:.7}
.cafe-choice-copy{display:grid;gap:3px;min-width:0}.cafe-choice-copy strong{font:10px/1.4 Silkscreen,monospace;font-weight:400}.cafe-choice-copy small{font-size:11px;line-height:1.3;color:#80664d}
.cafe-choice-votes{display:flex;flex:0 0 auto;align-items:center;gap:6px;font:10px/1 Silkscreen,monospace}.cafe-choice-bar{width:48px;height:6px;background:#f0e2c6}.cafe-choice-bar span{display:block;height:100%;background:#5f7f5c}
.cafe-note{margin:0;font-size:11px;line-height:1.6;color:#7f684f}
button:focus-visible,input:focus-visible{outline:3px solid #617e4d;outline-offset:2px}
</style>
