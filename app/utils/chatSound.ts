let context:AudioContext|undefined
let armed=false
let lastPlayed=0

export function armChatSound(){
  if(armed||typeof window==='undefined'||!window.AudioContext)return
  armed=true
  const unlock=()=>{
    try{
      context??=new AudioContext()
      if(context.state!=='running')void context.resume().catch(()=>{})
    }catch{}
  }
  window.addEventListener('pointerdown',unlock,{passive:true})
  window.addEventListener('keydown',unlock)
}

export function playChatSound(){
  const audio=context
  if(!audio||audio.state!=='running'||Date.now()-lastPlayed<450)return
  lastPlayed=Date.now()
  const start=audio.currentTime
  for(const [delay,frequency] of [[0,660],[.085,880]] as const){
    const tone=audio.createOscillator(),volume=audio.createGain()
    const at=start+delay
    tone.type='sine';tone.frequency.setValueAtTime(frequency,at)
    volume.gain.setValueAtTime(.0001,at)
    volume.gain.exponentialRampToValueAtTime(.035,at+.012)
    volume.gain.exponentialRampToValueAtTime(.0001,at+.14)
    tone.connect(volume).connect(audio.destination)
    tone.start(at);tone.stop(at+.15)
  }
}
