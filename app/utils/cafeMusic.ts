import type {CafeMood} from '../../shared/cafe'

// Kape & Chits jukebox: original, generated music made on the listener's own device with Web Audio (no audio files).
// The server only shares the mood and when it started; every note is worked out from the step number and the set's
// round, so everyone in the café hears the same notes at the same moment, on the server's clock.
// Sound needs the browser's permission: without a recent tap, play() reports 'blocked' and retries on the next tap.
export type CafeMusicStatus='off'|'playing'|'blocked'
export type CafeSession={mood:CafeMood;startedAt:number;round:number}
const PREFS_KEY='chits-cafe-music'
const LOOKAHEAD_S=.35,TICK_MS=90
export function readCafeVolume(){try{const value=JSON.parse(localStorage.getItem(PREFS_KEY)||'null')?.volume;return typeof value==='number'&&value>=0&&value<=1?value:.5}catch{return .5}}
function saveCafeVolume(volume:number){try{localStorage.setItem(PREFS_KEY,JSON.stringify({volume}))}catch{}}

type Song={bpm:number;swing:number;cutoff:number;chords:number[][]}
// Four-bar loops. Chords are MIDI notes; each lasts one bar of eight steps.
const SONGS:Record<CafeMood,Song>={
  cafe:{bpm:70,swing:0,cutoff:5200,chords:[[53,57,60,64],[52,55,59,62],[50,53,57,60],[48,52,55,59]]},
  lofi:{bpm:78,swing:.16,cutoff:2100,chords:[[57,60,64,67],[50,57,60,65],[55,59,62,65],[48,55,59,64]]},
  rain:{bpm:60,swing:0,cutoff:3200,chords:[[48,55,59,64],[45,55,60,64],[41,57,60,64],[43,55,59,64]]},
}
const PENTATONIC=[72,74,76,79,81,84]
const hz=(midi:number)=>440*2**((midi-69)/12)
// The same "random" choice on every device: a hash of the set, the step and which choice it is, as 0..1.
function chance(round:number,step:number,choice:number){
  let h=Math.imul(round*7919+step*31+choice,2654435761)
  h^=h>>>15;h=Math.imul(h,2246822519);h^=h>>>13;h=Math.imul(h,3266489917);h^=h>>>16
  return (h>>>0)/4294967296
}
export function stepMsOf(mood:CafeMood){return 60_000/SONGS[mood].bpm/2}

export function createCafeMusic(onStatus:(status:CafeMusicStatus)=>void,serverNow:()=>number){
  let ctx:AudioContext|undefined,bus:GainNode|undefined,filter:BiquadFilterNode|undefined,master:GainNode|undefined,noise:AudioBuffer|undefined
  let rain:{source:AudioBufferSourceNode;gain:GainNode}|undefined
  let session:CafeSession|null=null,listening=false,status:CafeMusicStatus='off',volume=readCafeVolume(),hidden=document.hidden,gestureArmed=false
  let timer:ReturnType<typeof setInterval>|undefined,moodTimer:ReturnType<typeof setTimeout>|undefined,nextIndex:number|undefined
  const set=(next:CafeMusicStatus)=>{if(status!==next){status=next;onStatus(next)}}
  function setup(){
    if(ctx)return ctx
    const Context=window.AudioContext||(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext
    if(!Context)return undefined
    ctx=new Context()
    master=ctx.createGain();master.gain.value=0
    filter=ctx.createBiquadFilter();filter.type='lowpass';filter.Q.value=.4
    bus=ctx.createGain();bus.gain.value=1
    bus.connect(filter).connect(master).connect(ctx.destination)
    noise=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate)
    const data=noise.getChannelData(0)
    for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1
    return ctx
  }
  function tone(freq:number,at:number,gain:number,decay:number,type:OscillatorType='sine',attack=.01){
    if(!ctx||!bus)return
    const osc=ctx.createOscillator(),env=ctx.createGain()
    osc.type=type;osc.frequency.value=freq
    env.gain.setValueAtTime(0,at);env.gain.linearRampToValueAtTime(gain,at+attack);env.gain.exponentialRampToValueAtTime(.0001,at+attack+decay)
    osc.connect(env).connect(bus);osc.start(at);osc.stop(at+attack+decay+.05)
  }
  // A soft electric-piano note: a sine with a quiet octave and a touch of the third harmonic.
  function keys(midi:number,at:number,gain:number,decay=1.8){const f=hz(midi);tone(f,at,gain,decay);tone(f*2,at,gain*.22,decay*.5);tone(f*3,at,gain*.05,decay*.25)}
  function hit(at:number,gain:number,decay:number,type:BiquadFilterType,freq:number){
    if(!ctx||!bus||!noise)return
    const source=ctx.createBufferSource(),band=ctx.createBiquadFilter(),env=ctx.createGain()
    source.buffer=noise;band.type=type;band.frequency.value=freq
    env.gain.setValueAtTime(gain,at);env.gain.exponentialRampToValueAtTime(.0001,at+decay)
    source.connect(band).connect(env).connect(bus);source.start(at,Math.random()*1.5);source.stop(at+decay+.02)
  }
  function kick(at:number){
    if(!ctx||!bus)return
    const osc=ctx.createOscillator(),env=ctx.createGain()
    osc.frequency.setValueAtTime(130,at);osc.frequency.exponentialRampToValueAtTime(45,at+.14)
    env.gain.setValueAtTime(.32,at);env.gain.exponentialRampToValueAtTime(.0001,at+.32)
    osc.connect(env).connect(bus);osc.start(at);osc.stop(at+.35)
  }
  function startRain(){
    if(!ctx||!bus||!noise||rain)return
    const source=ctx.createBufferSource(),low=ctx.createBiquadFilter(),high=ctx.createBiquadFilter(),gain=ctx.createGain()
    source.buffer=noise;source.loop=true;low.type='lowpass';low.frequency.value=1400;high.type='highpass';high.frequency.value=280
    gain.gain.setValueAtTime(0,ctx.currentTime);gain.gain.linearRampToValueAtTime(.16,ctx.currentTime+1.5)
    source.connect(low).connect(high).connect(gain).connect(bus);source.start()
    rain={source,gain}
  }
  function stopRain(){
    if(!rain||!ctx)return
    const {source,gain}=rain;rain=undefined
    gain.gain.cancelScheduledValues(ctx.currentTime);gain.gain.setTargetAtTime(0,ctx.currentTime,.15)
    source.stop(ctx.currentTime+.6)
  }
  // One eighth-note step of a mood. r(n) is the step's n-th shared random choice.
  function playStep(mood:CafeMood,at:number,index:number,r:(choice:number)=>number){
    const song=SONGS[mood],bar=Math.floor(index/8),beat=index%8,chord=song.chords[bar%song.chords.length]!
    if(mood==='cafe'){
      if(beat===0)chord.forEach((note,i)=>keys(note,at+i*.025,.07,2.6))
      if(beat===0||beat===4)tone(hz(chord[0]!-12),at,.09,1.4)
      if(beat%2===0&&beat&&r(0)<.7)keys(chord[(beat/2)%chord.length]!+12,at,.04,1.2)
      if(beat%2===1&&r(1)<.22)keys(PENTATONIC[Math.floor(r(2)*PENTATONIC.length)]!,at,.035,1.4)
    }else if(mood==='lofi'){
      if(beat===0)chord.forEach(note=>{tone(hz(note),at,.035,3.2,'triangle',.25);tone(hz(note)*1.004,at,.025,3.2,'triangle',.3)})
      if(beat===0||beat===3)tone(hz(chord[0]!-24),at,.11,.7)
      if(beat===0||beat===5)kick(at)
      if(beat===2||beat===6)hit(at,.12,.16,'bandpass',1800)
      hit(at,beat%2?.018:.03,.04,'highpass',7000)
      if(r(0)<.35)hit(at+r(1)*.2,.02,.012,'highpass',3000)
      if(beat===4&&r(2)<.5)keys(PENTATONIC[Math.floor(r(3)*4)]!-12,at,.035,1.6)
    }else if(mood==='rain'){
      if(beat===0)chord.forEach((note,i)=>keys(note,at+i*.06,.05,3.6))
      if(beat===4&&r(0)<.6)keys(chord[Math.floor(r(1)*chord.length)]!+12,at,.03,2.4)
      if(r(2)<.25)tone(1700+r(3)*900,at+r(4)*.3,.012,.08)
    }
  }
  // Every step whose server time falls within the lookahead is queued at the matching moment on the audio clock.
  // Joining mid-set starts at the next step, in time with everyone else; a set that hasn't started yet waits.
  function schedule(){
    if(!ctx||!session)return
    const {mood,startedAt,round}=session,song=SONGS[mood],stepMs=stepMsOf(mood),now=serverNow(),until=now+LOOKAHEAD_S*1000
    nextIndex??=Math.max(0,Math.ceil((now-startedAt)/stepMs))
    for(;startedAt+nextIndex*stepMs<until;nextIndex++){
      const at=ctx.currentTime+(startedAt+(nextIndex+(nextIndex%2?song.swing:0))*stepMs-now)/1000
      if(at>=ctx.currentTime-.02){const index=nextIndex;playStep(mood,Math.max(at,ctx.currentTime),index,choice=>chance(round,index,choice))}
    }
  }
  function run(){
    clearInterval(timer);timer=undefined
    if(!ctx||!session||!listening||hidden)return
    timer=setInterval(schedule,TICK_MS);schedule()
  }
  // The mood's sound: its filter, and rain noise under the rainy mood, switched when the set actually starts.
  function applyMood(){
    clearTimeout(moodTimer)
    if(!ctx||!filter||!session||!listening)return
    const {mood,startedAt}=session
    moodTimer=setTimeout(()=>{
      if(!ctx||!filter||session?.mood!==mood||!listening)return
      filter.frequency.setTargetAtTime(SONGS[mood].cutoff,ctx.currentTime,.1)
      if(mood==='rain')startRain();else stopRain()
    },Math.max(0,startedAt-serverNow()))
  }
  async function start(){
    const context=setup()
    if(!context||!master){set('blocked');return}
    try{await context.resume()}catch{}
    if(!listening)return
    if(context.state!=='running'){set('blocked');armGesture();return}
    disarmGesture()
    master.gain.cancelScheduledValues(context.currentTime);master.gain.setTargetAtTime(volume*.5,context.currentTime,.4)
    nextIndex=undefined;applyMood();set('playing');run()
  }
  // Autoplay rules: a blocked start waits for the visitor's next tap anywhere (music buttons handle their own taps).
  function onGesture(event:Event){if((event.target as Element|null)?.closest?.('[data-music-control]'))return;disarmGesture();void start()}
  function armGesture(){if(gestureArmed)return;gestureArmed=true;for(const type of ['pointerup','keydown'])document.addEventListener(type,onGesture,true)}
  function disarmGesture(){if(!gestureArmed)return;gestureArmed=false;for(const type of ['pointerup','keydown'])document.removeEventListener(type,onGesture,true)}
  return {
    get status(){return status},
    // The café's shared timeline. A new set starts from its first step; a repeat of the same set changes nothing.
    setSession(next:CafeSession|null){
      if(next?.startedAt===session?.startedAt&&next?.mood===session?.mood&&next?.round===session?.round)return
      session=next;nextIndex=undefined
      if(!next){clearInterval(timer);timer=undefined;stopRain();return}
      applyMood();run()
    },
    // Best from a tap or click: that's what lets the browser start the sound.
    play(){listening=true;return start()},
    stop(){
      listening=false;clearInterval(timer);timer=undefined;clearTimeout(moodTimer);disarmGesture()
      if(ctx&&master){master.gain.cancelScheduledValues(ctx.currentTime);master.gain.setTargetAtTime(0,ctx.currentTime,.12)}
      stopRain()
      set('off')
      // Once faded out, the audio device can rest until the next time.
      setTimeout(()=>{if(!listening)void ctx?.suspend().catch(()=>{})},600)
    },
    setVolume(value:number){
      volume=Math.max(0,Math.min(1,value));saveCafeVolume(volume)
      if(ctx&&master&&listening)master.gain.setTargetAtTime(volume*.5,ctx.currentTime,.1)
    },
    get volume(){return volume},
    // A hidden tab goes quiet and stops scheduling; back in view it rejoins the timeline where everyone else is.
    setHidden(value:boolean){
      hidden=value
      if(!ctx)return
      if(value){clearInterval(timer);timer=undefined;void ctx.suspend().catch(()=>{})}
      else if(listening)void start()
    },
    dispose(){clearInterval(timer);clearTimeout(moodTimer);disarmGesture();timer=undefined;listening=false;session=null;rain=undefined;void ctx?.close().catch(()=>{});ctx=undefined},
  }
}
export type CafeMusic=ReturnType<typeof createCafeMusic>
