import type {JukeboxNowPlaying} from '../../shared/jukebox'

// Plays the store's shared timeline through one reused <audio> element. Reusing the element keeps
// iOS's one-tap unlock and means two copies of a song can never play at once. Separate from sound effects.
export type JukeboxListenStatus='off'|'needs_gesture'|'loading'|'playing'|'waiting'|'error'
export type JukeboxPrefs={on:boolean;volume:number}
const PREFS_KEY='chits-store-jukebox'
// Seek only when clearly out of step; small corrections would stutter.
const DRIFT_LIMIT_S=1,DRIFT_CHECK_MS=3000,CLOCK_SAMPLE_MAX_AGE_MS=120_000

// Music stays off until the visitor turns it on; the choice is remembered on this device only.
export function readJukeboxPrefs():JukeboxPrefs{
  try{
    const raw:unknown=JSON.parse(localStorage.getItem(PREFS_KEY)||'null')
    const prefs=raw&&typeof raw==='object'?raw as Partial<JukeboxPrefs>:{}
    return {on:prefs.on===true,volume:typeof prefs.volume==='number'&&prefs.volume>=0&&prefs.volume<=1?prefs.volume:.35}
  }catch{return {on:false,volume:.35}}
}
export function saveJukeboxPrefs(prefs:JukeboxPrefs){try{localStorage.setItem(PREFS_KEY,JSON.stringify(prefs))}catch{}}
// iOS ignores element volume (it always reads back 1), so only mute is offered there.
export function canSetVolume(){try{const probe=new Audio();probe.volume=.5;return probe.volume===.5}catch{return false}}

export function createJukeboxPlayer(onStatus:(status:JukeboxListenStatus)=>void){
  const audio=new Audio()
  audio.preload='none'
  let nowPlaying:JukeboxNowPlaying|null=null,loadedSrc='',failedSrc=''
  let wanted=false,hidden=document.hidden,primed=false,disposed=false,gestureArmed=false
  let status:JukeboxListenStatus='off',playRequest=0,lastDriftCheck=0
  let offset=0,bestRtt=Infinity,bestRttAt=0
  let startTimer:ReturnType<typeof setTimeout>|undefined
  const set=(next:JukeboxListenStatus)=>{if(status!==next){status=next;onStatus(next)}}
  const serverNow=()=>Date.now()+offset
  const position=()=>nowPlaying?(serverNow()-nowPlaying.startedAt)/1000:0
  const halt=()=>{if(!audio.paused)audio.pause()}
  function load(src:string){if(loadedSrc!==src){loadedSrc=src;audio.preload='auto';audio.src=src}}
  function seekIfDrifted(){
    if(audio.readyState<1||!nowPlaying||audio.seeking)return
    const at=position()
    if(at>=0&&Math.abs(audio.currentTime-at)>DRIFT_LIMIT_S)audio.currentTime=at
  }
  function play(){
    const request=++playRequest
    if(status!=='playing')set('loading')
    audio.play().then(()=>{if(request===playRequest&&!audio.paused)set('playing')}).catch((error:unknown)=>{
      if(request!==playRequest||disposed)return
      // Autoplay rules: wait for the visitor's next tap. Other errors arrive as the element's error event.
      if(error instanceof DOMException&&error.name==='NotAllowedError'){set('needs_gesture');armGesture()}
    })
  }
  function sync(){
    clearTimeout(startTimer)
    if(disposed)return
    const track=nowPlaying?.track
    if(!wanted){halt();set('off');return}
    if(!track){halt();set('waiting');return}
    if(failedSrc===track.src){halt();set('error');return}
    if(hidden){halt();return}
    const at=position()
    // The server is about to change track; stay quiet until it does.
    if(at>=track.durationMs/1000-.25){halt();set('waiting');return}
    load(track.src)
    if(at<0){halt();set('loading');startTimer=setTimeout(sync,Math.min(-at*1000,5000));return}
    seekIfDrifted()
    if(audio.paused)play()
  }
  // Inside a tap: a muted play-and-pause lets iOS start this element later without another tap.
  function prime(){
    if(primed||hidden||!audio.paused||!nowPlaying)return
    load(nowPlaying.track.src)
    audio.muted=true
    audio.play().then(()=>{primed=true;audio.pause()}).catch(()=>{}).finally(()=>{audio.muted=false;sync()})
  }
  function onGesture(event:Event){
    if((event.target as Element|null)?.closest?.('[data-music-control]'))return
    disarmGesture()
    resume()
  }
  function armGesture(){
    if(gestureArmed)return
    gestureArmed=true
    for(const type of ['pointerup','keydown'])document.addEventListener(type,onGesture,true)
  }
  function disarmGesture(){
    if(!gestureArmed)return
    gestureArmed=false
    for(const type of ['pointerup','keydown'])document.removeEventListener(type,onGesture,true)
  }
  function resume(){if(!wanted||disposed)return;failedSrc='';sync();if(audio.paused)prime()}
  const listeners:Record<string,()=>void>={
    loadedmetadata:()=>seekIfDrifted(),
    playing:()=>{if(wanted)set('playing')},
    waiting:()=>{if(wanted&&!audio.paused)set('loading')},
    ended:()=>sync(),
    timeupdate:()=>{
      const now=Date.now()
      if(now-lastDriftCheck<DRIFT_CHECK_MS)return
      lastDriftCheck=now
      if(nowPlaying&&position()>=nowPlaying.track.durationMs/1000-.25)sync()
      else seekIfDrifted()
    },
    // A missing or unplayable file is skipped locally; the shared timeline carries on.
    error:()=>{if(disposed||!loadedSrc||!audio.error)return;failedSrc=loadedSrc;halt();if(wanted)set('error')},
  }
  for(const [type,listener] of Object.entries(listeners))audio.addEventListener(type,listener)
  return {
    serverNow,
    get status(){return status},
    enable(){wanted=true;disarmGesture();resume()},
    disable(){wanted=false;disarmGesture();sync()},
    resume,
    setTimeline(next:JukeboxNowPlaying|null){
      const changed=next?.track.src!==nowPlaying?.track.src||next?.startedAt!==nowPlaying?.startedAt
      nowPlaying=next
      if(changed)sync()
    },
    // Ping round trips give the server clock to within half the round trip. The tightest recent one wins.
    noteServerTime(serverTime:number,sentAt:number,receivedAt:number){
      const rtt=receivedAt-sentAt
      if(!Number.isFinite(serverTime)||rtt<0||rtt>10_000)return
      if(rtt<=bestRtt||receivedAt-bestRttAt>CLOCK_SAMPLE_MAX_AGE_MS){bestRtt=rtt;bestRttAt=receivedAt;offset=serverTime+rtt/2-receivedAt;seekIfDrifted()}
    },
    // Rough offset from a state message, used only until the first ping answer arrives.
    noteStateTime(serverTime:number){if(bestRtt===Infinity&&Number.isFinite(serverTime))offset=serverTime-Date.now()},
    setVolume(value:number){audio.volume=Math.max(0,Math.min(1,value))},
    setHidden(value:boolean){hidden=value;sync()},
    dispose(){
      disposed=true;clearTimeout(startTimer);disarmGesture()
      for(const [type,listener] of Object.entries(listeners))audio.removeEventListener(type,listener)
      audio.pause();audio.removeAttribute('src');audio.load()
    },
  }
}
export type JukeboxPlayer=ReturnType<typeof createJukeboxPlayer>
