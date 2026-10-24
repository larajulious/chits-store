import { broadcastScene, inScene } from './room'
import { chooseCafeMood, type CafeJukeboxState, type CafeJukeboxVote, type CafeMood } from '../../shared/cafe'

// Kape & Chits' shared music: one timeline of moods, like the store's jukebox. Only the mood and its start time are
// sent; each listener's device generates the same notes from them. It plays around the clock, as the café is open.
// CAFE_SET_SECONDS shortens the sets for tests.
const SET_MS=Math.max(5,Number(process.env.CAFE_SET_SECONDS)||240)*1000
const START_LEAD_MS=1200,VOTE_BROADCAST_MS=300,VOTE_COOLDOWN_MS=400

type VoteResult={ok:true;round:number;mood:CafeMood}|{ok:false;round:number;reason:'round_closed'|'slow_down'|'not_in_cafe'}
let session:{mood:CafeMood;startedAt:number;round:number}|undefined
// Keyed by visitor ID, so reconnects and extra tabs replace a vote. Votes count only while the voter is in the café.
const votes=new Map<number,CafeMood>(),lastVoteAt=new Map<number,number>(),lastPlayedAt:Partial<Record<CafeMood,number>>={}
let endTimer:ReturnType<typeof setTimeout>|undefined,voteTimer:ReturnType<typeof setTimeout>|undefined

function tally(){
  const counts:Record<CafeMood,number>={cafe:0,lofi:0,rain:0}
  for(const [visitorId,mood] of votes)if(inScene(visitorId,'cafe'))counts[mood]++
  return counts
}
function start(mood:CafeMood){
  const startedAt=Date.now()+START_LEAD_MS
  session={mood,startedAt,round:(session?.round??0)+1};lastPlayedAt[mood]=startedAt
  votes.clear();lastVoteAt.clear()
  clearTimeout(endTimer);endTimer=setTimeout(()=>start(chooseCafeMood(tally(),lastPlayedAt)),startedAt+SET_MS-Date.now());endTimer.unref?.()
  broadcastState()
  // The café's mood is the neighbourhood's weather: the rainy mood brings rain to the street too.
  broadcastScene('outside',{type:'cafe_mood',mood})
}
function current(){if(!session)start('cafe');return session!}
// Jeepney riders hear the café's music too, so they follow its timeline (they can't vote: see voteCafeMood).
function broadcastState(){clearTimeout(voteTimer);voteTimer=undefined;const state={type:'cafe_jukebox',state:cafeJukeboxState()};broadcastScene('cafe',state);broadcastScene('jeepney',state)}

export function cafeJukeboxState():CafeJukeboxState{
  const {mood,startedAt,round}=current(),counts=tally()
  return {mood,startedAt,endsAt:startedAt+SET_MS,round,votes:counts,upNext:chooseCafeMood(counts,lastPlayedAt),serverNow:Date.now()}
}
export function cafeMood(){return current().mood}
export function cafeVoteOf(visitorId:number):CafeJukeboxVote{const mood=votes.get(visitorId);return mood?{round:current().round,mood}:null}
export function voteCafeMood(visitorId:number,mood:CafeMood,forRound?:number):VoteResult{
  const {round}=current()
  if(!inScene(visitorId,'cafe'))return {ok:false,round,reason:'not_in_cafe'}
  if(forRound!==undefined&&forRound!==round)return {ok:false,round,reason:'round_closed'}
  const now=Date.now()
  if(now-(lastVoteAt.get(visitorId)??0)<VOTE_COOLDOWN_MS)return {ok:false,round,reason:'slow_down'}
  lastVoteAt.set(visitorId,now)
  if(votes.get(visitorId)!==mood){
    votes.set(visitorId,mood)
    // Several votes in quick succession share one update.
    if(!voteTimer){voteTimer=setTimeout(broadcastState,VOTE_BROADCAST_MS);voteTimer.unref?.()}
  }
  return {ok:true,round,mood}
}
