import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { createError } from 'h3'
import { db } from './db'
import { broadcast } from './room'
import { mp3DurationMs } from './mp3'
import { chooseNextTrack, votingCandidates, type JukeboxAdminState, type JukeboxLibraryEntry, type JukeboxMyVote, type JukeboxState, type JukeboxTrack } from '../../shared/jukebox'

// One shared timeline for the whole store. It lives in this process, which matches the single PM2 fork:
// clients receive the start time and work out their own position, so nothing is sent while a track plays.
// Clients get a moment to load the next track before it starts.
const START_LEAD_MS=1200,TRACK_GAP_MS=1500
const VOTE_BROADCAST_MS=300,VOTE_COOLDOWN_MS=400
const LIBRARY_CHECK_MS=10_000,MAX_TRACKS=20,MAX_BYTES=30*1024*1024,MIN_SECONDS=5,MAX_SECONDS=30*60,DURATION_TOLERANCE_MS=1500
const TRACK_ID=/^[a-z0-9][a-z0-9-]{0,39}$/,TRACK_FILE=/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}\.mp3$/

type LibraryTrack=Omit<JukeboxLibraryEntry,'selected'>&{path:string;version:string}
type Settings={enabled:boolean;votingEnabled:boolean;trackIds:string[]|null}
type VoteResult={ok:true;round:number;trackId:string}|{ok:false;round:number;reason:'disabled'|'voting_off'|'round_closed'|'not_candidate'|'slow_down'}

let library:LibraryTrack[]=[],libraryError:string|undefined,libraryLoaded=false,librarySignature='',started=false
let settingsCache:Settings|undefined
let playback:{trackId:string;startedAt:number}|null=null
let round=0,candidates:string[]=[]
// Keyed by visitor ID: reconnects and extra tabs replace a vote instead of adding one.
const votes=new Map<number,string>(),lastVoteAt=new Map<number,number>(),lastPlayedAt:Record<string,number>={}
let endTimer:ReturnType<typeof setTimeout>|undefined,voteTimer:ReturnType<typeof setTimeout>|undefined

export function jukeboxDir(){return resolve(process.env.JUKEBOX_DIR||'music')}
// Project-relative when the music folder is inside the project, otherwise the full path.
const shown=(path:string)=>{const inside=relative(process.cwd(),path);return inside&&!inside.startsWith('..')?inside:path}
function text(value:unknown,max:number){return typeof value==='string'?value.normalize('NFKC').replace(/[\p{C}]/gu,'').trim().slice(0,max):''}

function checkTrack(dir:string,value:unknown,index:number,seenIds:Set<string>,seenFiles:Set<string>):LibraryTrack{
  const item=(value&&typeof value==='object'?value:{}) as Record<string,unknown>
  const id=typeof item.id==='string'&&TRACK_ID.test(item.id)?item.id:`track-${index+1}`
  const file=typeof item.file==='string'?item.file:''
  const entry:LibraryTrack={id,title:text(item.title,40)||id,mood:text(item.mood,40),artist:text(item.artist,60),license:text(item.license,160),file,durationMs:null,available:false,path:'',version:''}
  const fail=(reason:string)=>Object.assign(entry,{reason})
  if(id!==item.id)return fail('Use an id of lowercase letters, numbers and dashes')
  if(seenIds.has(id))return fail('Another track already uses this id')
  seenIds.add(id)
  if(!text(item.title,40))return fail('Add a title')
  if(!TRACK_FILE.test(file))return fail('Use an .mp3 file name without folders')
  if(seenFiles.has(file))return fail('Another track already uses this file')
  seenFiles.add(file)
  const declared=item.durationSec
  if(typeof declared!=='number'||!Number.isFinite(declared)||declared<MIN_SECONDS||declared>MAX_SECONDS)return fail(`Add durationSec between ${MIN_SECONDS} and ${MAX_SECONDS}`)
  const path=join(dir,file)
  let stat
  try{stat=statSync(path)}catch{return fail(`Missing file ${file}`)}
  if(!stat.isFile()||stat.size===0)return fail('Audio file is empty')
  if(stat.size>MAX_BYTES)return fail('Audio file is larger than 30 MB')
  let measured:number|null=null
  try{measured=mp3DurationMs(readFileSync(path))}catch{}
  if(!measured)return fail('Not a readable MP3 file')
  entry.durationMs=measured
  if(Math.abs(measured-declared*1000)>DURATION_TOLERANCE_MS)return fail(`durationSec says ${declared}s but the file plays for ${(measured/1000).toFixed(1)}s`)
  return Object.assign(entry,{available:true,path,version:`${stat.size.toString(36)}${Math.floor(stat.mtimeMs).toString(36)}`})
}
// Only tracks whose file exists and whose measured length matches the manifest are ever offered.
function loadLibrary(){
  const dir=jukeboxDir(),manifest=join(dir,'tracks.json')
  library=[];libraryError=undefined;libraryLoaded=true
  let raw:unknown
  try{raw=JSON.parse(readFileSync(manifest,'utf8'))}
  catch{libraryError=existsSync(manifest)?`${shown(manifest)} is not valid JSON`:`No track manifest at ${shown(manifest)}`;console.warn(`[jukebox] ${libraryError}`);return}
  const tracks=raw&&typeof raw==='object'?(raw as {tracks?:unknown}).tracks:undefined
  if(!Array.isArray(tracks)){libraryError=`${shown(manifest)} needs a "tracks" array`;console.warn(`[jukebox] ${libraryError}`);return}
  const seenIds=new Set<string>(),seenFiles=new Set<string>()
  library=tracks.slice(0,MAX_TRACKS).map((value,index)=>checkTrack(dir,value,index,seenIds,seenFiles))
  if(tracks.length>MAX_TRACKS)libraryError=`Only the first ${MAX_TRACKS} tracks are used`
  const unavailable=library.filter(track=>!track.available)
  if(unavailable.length)console.warn(`[jukebox] Unavailable: ${unavailable.map(track=>`${track.id} (${track.reason})`).join('; ')}`)
}
// Size and modification time of the folder, the manifest and every listed file. Any change means
// tracks were added, removed, replaced or re-described, so the library is read again.
function readSignature(){
  const dir=jukeboxDir()
  return [dir,join(dir,'tracks.json'),...library.map(track=>join(dir,track.file))].map(path=>{
    try{const stat=statSync(path);return `${stat.size}:${stat.mtimeMs}`}catch{return '-'}
  }).join('|')
}
function reloadLibrary(){loadLibrary();librarySignature=readSignature()}
function ensureLibrary(){if(!libraryLoaded)reloadLibrary()}
// Picks up music changes without a restart; a few file stats every ten seconds.
function watchLibrary(){
  const timer=setInterval(()=>{
    if(readSignature()===librarySignature)return
    console.info('[jukebox] Music folder changed; reloading tracks')
    reloadLibrary();refreshPlaylist()
  },LIBRARY_CHECK_MS)
  timer.unref?.()
}

function settings():Settings{
  if(!settingsCache){
    const row=db().prepare('SELECT enabled,voting_enabled,track_ids FROM jukebox_settings WHERE id=1').get() as {enabled:number;voting_enabled:number;track_ids:string|null}
    let trackIds:string[]|null=null
    try{const parsed:unknown=row.track_ids?JSON.parse(row.track_ids):null;if(Array.isArray(parsed))trackIds=parsed.filter((id):id is string=>typeof id==='string')}catch{}
    settingsCache={enabled:row.enabled===1,votingEnabled:row.voting_enabled===1,trackIds}
  }
  return settingsCache
}
function saveSettings(next:Settings){
  db().prepare('UPDATE jukebox_settings SET enabled=?,voting_enabled=?,track_ids=? WHERE id=1').run(next.enabled?1:0,next.votingEnabled?1:0,next.trackIds?JSON.stringify(next.trackIds):null)
  settingsCache=next
}

const track=(id:string)=>library.find(entry=>entry.id===id)
// Without a saved selection, every available track plays (new files join automatically).
function playlist(){const ids=settings().trackIds;return library.filter(entry=>entry.available&&(!ids||ids.includes(entry.id))).map(entry=>entry.id)}
function publicTrack(entry:LibraryTrack):JukeboxTrack{
  return {id:entry.id,title:entry.title,mood:entry.mood,artist:entry.artist,durationMs:entry.durationMs!,src:`/jukebox/audio/${encodeURIComponent(entry.file)}?v=${entry.version}`}
}
function tally(){
  const counts:Record<string,number>=Object.fromEntries(candidates.map(id=>[id,0]))
  for(const id of votes.values())if(id in counts)counts[id]!++
  return counts
}
function upNext(){return playback?chooseNextTrack(candidates,settings().votingEnabled?votes.values():[]):null}

function broadcastState(){
  clearTimeout(voteTimer);voteTimer=undefined
  broadcast({type:'jukebox',state:jukeboxState()})
}
function scheduleVoteBroadcast(){
  // Several votes in quick succession share one small totals message.
  if(voteTimer)return
  voteTimer=setTimeout(()=>{voteTimer=undefined;broadcast({type:'jukebox_votes',round,votes:tally(),upNext:upNext()})},VOTE_BROADCAST_MS)
  voteTimer.unref?.()
}
function clearRound(){votes.clear();lastVoteAt.clear();round++}
function stopPlayback(){
  clearTimeout(endTimer)
  if(!playback&&!candidates.length)return
  playback=null;candidates=[];clearRound();broadcastState()
}
function startTrack(id:string,order:string[]){
  const entry=track(id)!,startedAt=Date.now()+START_LEAD_MS
  playback={trackId:id,startedAt};lastPlayedAt[id]=startedAt
  clearRound()
  candidates=votingCandidates(order,id,lastPlayedAt)
  clearTimeout(endTimer)
  endTimer=setTimeout(advance,startedAt+entry.durationMs!+TRACK_GAP_MS-Date.now())
  endTimer.unref?.()
  broadcastState()
}
// Closes the voting round: the winner (or the longest-waiting track) plays next.
function advance(){
  clearTimeout(endTimer)
  const order=playlist()
  if(!settings().enabled||!order.length){stopPlayback();return}
  const open=candidates.filter(id=>order.includes(id))
  const pool=open.length?open:votingCandidates(order,playback?.trackId??null,lastPlayedAt)
  startTrack(chooseNextTrack(pool,settings().votingEnabled?votes.values():[])!,order)
}
// After the library or selection changes, keep the current track if it can still play.
function refreshPlaylist(){
  const order=playlist()
  if(!settings().enabled||!order.length){stopPlayback();return}
  if(!playback||!track(playback.trackId)?.available){advance();return}
  candidates=votingCandidates(order,playback.trackId,lastPlayedAt)
  for(const [visitor,id] of votes)if(!candidates.includes(id))votes.delete(visitor)
  broadcastState()
}
function ensureStarted(){
  ensureLibrary()
  if(started)return
  started=true
  watchLibrary()
  if(settings().enabled)advance()
}

export function jukeboxState():JukeboxState{
  ensureStarted()
  const {enabled,votingEnabled}=settings(),current=playback?track(playback.trackId):undefined
  return {enabled,votingEnabled,nowPlaying:current&&playback?{track:publicTrack(current),startedAt:playback.startedAt}:null,round,
    candidates:candidates.flatMap(id=>{const entry=track(id);return entry?.available?[publicTrack(entry)]:[]}),votes:tally(),upNext:upNext(),serverNow:Date.now()}
}
export function jukeboxVoteOf(visitorId:number):JukeboxMyVote{const trackId=votes.get(visitorId);return trackId?{round,trackId}:null}
export function voteJukebox(visitorId:number,trackId:string,forRound?:number):VoteResult{
  ensureStarted()
  const {enabled,votingEnabled}=settings()
  if(!enabled||!playback)return {ok:false,round,reason:'disabled'}
  if(!votingEnabled)return {ok:false,round,reason:'voting_off'}
  if(forRound!==undefined&&forRound!==round)return {ok:false,round,reason:'round_closed'}
  if(!candidates.includes(trackId))return {ok:false,round,reason:'not_candidate'}
  const now=Date.now()
  if(now-(lastVoteAt.get(visitorId)??0)<VOTE_COOLDOWN_MS)return {ok:false,round,reason:'slow_down'}
  lastVoteAt.set(visitorId,now)
  if(votes.get(visitorId)!==trackId){votes.set(visitorId,trackId);scheduleVoteBroadcast()}
  return {ok:true,round,trackId}
}
export function clearJukeboxVotes(){
  if(!votes.size)return
  votes.clear();lastVoteAt.clear();scheduleVoteBroadcast()
}

export function jukeboxAdminState():JukeboxAdminState{
  const state=jukeboxState(),ids=settings().trackIds
  return {state,libraryError,totalVotes:votes.size,
    library:library.map(({path:_path,version:_version,...entry})=>({...entry,selected:ids?ids.includes(entry.id):entry.available}))}
}
export function updateJukeboxSettings(changes:{enabled?:boolean;votingEnabled?:boolean;trackIds?:string[]}){
  ensureStarted()
  if(changes.trackIds){
    const ids=[...new Set(changes.trackIds)]
    if(!ids.length)throw createError({statusCode:400,statusMessage:'Choose at least one track, or turn the jukebox off'})
    if(ids.some(id=>!track(id)?.available))throw createError({statusCode:400,statusMessage:'Only available tracks can be selected'})
    changes.trackIds=ids
  }
  const previous=settings()
  saveSettings({enabled:changes.enabled??previous.enabled,votingEnabled:changes.votingEnabled??previous.votingEnabled,trackIds:changes.trackIds??previous.trackIds})
  if(changes.votingEnabled===false){votes.clear();lastVoteAt.clear()}
  refreshPlaylist()
  return jukeboxAdminState()
}
export function skipJukeboxTrack(){
  ensureStarted()
  if(!settings().enabled)throw createError({statusCode:409,statusMessage:'Turn the jukebox on first'})
  if(!playlist().length)throw createError({statusCode:409,statusMessage:'No playable tracks are selected'})
  advance()
  return jukeboxAdminState()
}
export function rescanJukeboxLibrary(){
  ensureStarted()
  reloadLibrary()
  refreshPlaylist()
  return jukeboxAdminState()
}
// Only manifest-approved files are served, so the URL can never reach another path.
export function jukeboxAudioFile(file:string){
  ensureLibrary()
  const entry=library.find(item=>item.available&&item.file===file)
  return entry?{path:entry.path,version:entry.version}:undefined
}
