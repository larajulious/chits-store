import { mascotFloorPoint, residentCats, type CatMood, type CatName, type MascotSnapshot } from '../shared/store-mascot'

type Point={x:number;y:number}
type PetResult='petted'|'too_far'|'busy'
type Cat={name:CatName;roams:boolean;x:number;y:number;mood:CatMood;facing:-1|1;until:number;path:Point[];pathTarget:Point|null;lastPlayAt:number;petUntil:number;lastPetAt:number;lastRouteAt:number;noticeAt:number}
// A playdate: Miming strolls over to Onay and the two sit side by side for a while. There is no fighting.
type Playdate={visitor:Cat;host:Cat;until:number;together:boolean;seat:Point}
const spots:Point[]=[{x:232,y:466},{x:180,y:280},{x:120,y:280},{x:190,y:330},{x:170,y:420},{x:90,y:460},{x:250,y:420},{x:210,y:510},{x:270,y:400}]
const pick=<T>(values:T[]):T=>values[Math.floor(Math.random()*values.length)]!
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y)
const key=(point:Point)=>`${point.x},${point.y}`
const yarnMoods=new Set<CatMood>(['noticing_yarn','approaching_yarn','playing_with_yarn'])
const PLAYDATE_COOLDOWN_MS=18_000,PLAYDATE_CHANCE=.25,CAT_GAP=16,SEAT_GAP=20

function nearestGrid(point:Point):Point{
  let closest=spots[0]!,best=Infinity
  for(let y=280;y<=520;y+=20)for(let x=40;x<=320;x+=20){
    if(!mascotFloorPoint(x,y,7))continue
    const score=Math.hypot(x-point.x,y-point.y)
    if(score<best){best=score;closest={x,y}}
  }
  return closest
}
function route(from:Point,to:Point):Point[]{
  const start=nearestGrid(from),end=nearestGrid(to),queue=[start],seen=new Set([key(start)]),previous=new Map<string,string>()
  for(let i=0;i<queue.length;i++){
    const current=queue[i]!
    if(current.x===end.x&&current.y===end.y)break
    for(const [dx,dy] of [[20,0],[-20,0],[0,20],[0,-20]] as const){
      const next={x:current.x+dx,y:current.y+dy},nextKey=key(next)
      if(!seen.has(nextKey)&&mascotFloorPoint(next.x,next.y,7)){seen.add(nextKey);previous.set(nextKey,key(current));queue.push(next)}
    }
  }
  if(!seen.has(key(end)))return []
  const path:Point[]=[]
  for(let step=key(end);step!==key(start);step=previous.get(step)!){const [x,y]=step.split(',').map(Number);path.push({x:x!,y:y!})}
  return path.reverse()
}
function sightClear(from:Point,to:Point){
  const steps=Math.max(2,Math.ceil(distance(from,to)/12))
  for(let i=1;i<steps;i++){const fraction=i/steps;if(!mascotFloorPoint(from.x+(to.x-from.x)*fraction,from.y+(to.y-from.y)*fraction))return false}
  return true
}
function moveCat(cat:Cat,delta:number,speed:number){
  const next=cat.path[0]
  if(!next)return
  if(Math.abs(next.x-cat.x)>1)cat.facing=next.x>cat.x?1:-1
  const gap=distance(cat,next),step=Math.min(gap,speed*delta)
  if(gap<=step+.001){cat.x=next.x;cat.y=next.y;cat.path.shift()}
  else{cat.x+=(next.x-cat.x)/gap*step;cat.y+=(next.y-cat.y)/gap*step}
}

// One instance belongs to one Phaser scene. No timers, network, Vue state, or persistence.
export function createLocalMascot(){
  const cats:Cat[]=residentCats.map(({name,x,y,mood,roams})=>({name,roams,x,y,mood,facing:1,until:mood==='sitting'?2500:6000,path:[],pathTarget:null,lastPlayAt:0,petUntil:0,lastPetAt:-Infinity,lastRouteAt:0,noticeAt:0}))
  const yarn={x:204,y:474,vx:0,vy:0,held:false}
  let lastStimulusX=yarn.x,lastStimulusY=yarn.y,lastTossAt=-Infinity
  let playdate:Playdate|null=null,lastPlaydateAt=-Infinity

  function setRoute(cat:Cat,target:Point,mood:CatMood,now:number){
    cat.path=route(cat,target);cat.pathTarget={...target};cat.mood=cat.path.length?mood:'sitting';cat.lastRouteAt=now
  }
  const inPlaydate=(cat:Cat)=>Boolean(playdate&&(playdate.visitor===cat||playdate.host===cat))
  // Onay only ever sleeps or stands; standing uses the idle mood.
  function settleHost(cat:Cat,now:number){cat.mood='idle';cat.until=now+3000+Math.random()*3000}
  function maybeStartPlaydate(cat:Cat,now:number){
    const host=cats.find(other=>other!==cat&&!other.roams)
    if(!cat.roams||!host||playdate||now-lastPlaydateAt<PLAYDATE_COOLDOWN_MS||Math.random()>=PLAYDATE_CHANCE)return false
    if(now<host.petUntil||now<cat.petUntil||cat.noticeAt)return false
    // Sit beside the host on whichever side is open floor; the feedback board blocks Onay's right.
    const seat=[-1,1].map(side=>({x:host.x+side*SEAT_GAP,y:host.y})).find(point=>mascotFloorPoint(point.x,point.y,7))
    if(!seat)return false
    playdate={visitor:cat,host,until:now+15_000,together:false,seat}
    cat.path=[...route(cat,seat),seat];cat.mood='visiting';cat.lastRouteAt=now
    return true
  }
  function endPlaydate(now:number){
    if(!playdate)return
    const {visitor,host}=playdate
    visitor.path=[];visitor.mood=Math.random()<.3?'resting':'sitting';visitor.until=now+2000+Math.random()*2500
    settleHost(host,now)
    playdate=null;lastPlaydateAt=now
  }
  function tickPlaydate(now:number,delta:number){
    if(!playdate)return
    const {visitor,host,seat}=playdate
    if(playdate.together){
      visitor.facing=host.x>=visitor.x?1:-1;host.facing=visitor.x>=host.x?1:-1
      if(now>=playdate.until)endPlaydate(now)
      return
    }
    if(now>=playdate.until){endPlaydate(now);return}
    moveCat(visitor,delta,38)
    // Arrived: a sleeping host wakes up, and the two sit together.
    if(!visitor.path.length||distance(visitor,seat)<1){
      visitor.x=seat.x;visitor.y=seat.y;visitor.path=[]
      playdate.together=true;playdate.until=now+3500+Math.random()*2000
      for(const cat of [visitor,host])cat.mood='snuggling'
    }
  }
  // Onay stays on the spot: asleep for a good while, then standing up for a few seconds.
  function tickHost(cat:Cat,now:number){
    if(now<cat.petUntil){cat.mood='idle';return}
    if(now<cat.until)return
    if(cat.mood==='sleeping')settleHost(cat,now)
    else{cat.mood='sleeping';cat.until=now+8000+Math.random()*10_000}
  }
  function randomRest(cat:Cat,now:number){
    if(maybeStartPlaydate(cat,now))return
    const choice=Math.random()
    if(choice<.39){setRoute(cat,pick(spots),'walking',now);cat.until=now+13_000}
    else if(choice<.60){cat.mood='sitting';cat.until=now+2800+Math.random()*4300}
    else if(choice<.78){cat.mood='resting';cat.until=now+3500+Math.random()*4500}
    else if(choice<.91){cat.mood='sleeping';cat.until=now+5000+Math.random()*7000}
    else{cat.mood='stretching';cat.until=now+1300+Math.random()*800}
  }
  function noticeYarn(cat:Cat,now:number){
    // Onay never leaves the spot, so only Miming goes after the yarn.
    if(!cat.roams)return
    const target={x:yarn.x,y:yarn.y},gap=distance(cat,target)
    if(gap>175&&(gap>230||!sightClear(cat,target)))return
    if(yarnMoods.has(cat.mood)){
      if(cat.mood==='approaching_yarn'&&cat.pathTarget&&distance(cat.pathTarget,target)>28&&now-cat.lastRouteAt>300)setRoute(cat,target,'approaching_yarn',now)
      return
    }
    if(Math.random()<(cat.mood==='sleeping'?.30:.12))return
    // A moving yarn ball beats a playdate.
    if(inPlaydate(cat))endPlaydate(now)
    cat.noticeAt=now+400+Math.random()*(cat.mood==='sleeping'?2800:1500)
  }
  function stirYarn(now:number){
    if(distance({x:lastStimulusX,y:lastStimulusY},yarn)<12)return
    lastStimulusX=yarn.x;lastStimulusY=yarn.y
    for(const cat of cats)if(!cat.noticeAt)noticeYarn(cat,now)
  }
  function tickCat(cat:Cat,now:number,delta:number){
    if(!cat.roams){tickHost(cat,now);return}
    if(now<cat.petUntil){cat.mood='sitting';cat.path=[];return}
    if(cat.noticeAt&&now>=cat.noticeAt){cat.noticeAt=0;cat.mood='noticing_yarn';cat.facing=yarn.x>=cat.x?1:-1;cat.until=now+700+Math.random()*500;cat.path=[]}
    if(cat.mood==='noticing_yarn'&&now>=cat.until){
      if(distance(cat,yarn)<25){cat.mood='playing_with_yarn';cat.until=now+2500+Math.random()*2100;cat.lastPlayAt=now}
      else{setRoute(cat,yarn,'approaching_yarn',now);cat.until=now+8000}
    }
    if(cat.mood==='approaching_yarn'){
      if(cat.pathTarget&&distance(cat.pathTarget,yarn)>32&&now-cat.lastRouteAt>300)setRoute(cat,yarn,'approaching_yarn',now)
      moveCat(cat,delta,54)
      if(distance(cat,yarn)<20||(!cat.path.length&&distance(cat,yarn)<31)){
        cat.mood='playing_with_yarn';cat.path=[];cat.until=now+2500+Math.random()*2100;cat.lastPlayAt=now
      }else if(now>=cat.until){cat.mood='returning_to_idle';cat.until=now+1000}
    }else if(cat.mood==='playing_with_yarn'){
      if(now-cat.lastPlayAt>800&&!yarn.held){cat.lastPlayAt=now;const angle=Math.random()*Math.PI*2;yarn.vx=Math.cos(angle)*55;yarn.vy=Math.sin(angle)*55}
      const gap=distance(cat,yarn)
      if(gap>18&&gap<65){const step=Math.min(gap-18,24*delta),x=cat.x+(yarn.x-cat.x)/gap*step,y=cat.y+(yarn.y-cat.y)/gap*step;if(mascotFloorPoint(x,y,7)){cat.x=x;cat.y=y}}
      if(now>=cat.until){cat.mood='sitting';cat.until=now+1800+Math.random()*2100}
    }else if(cat.mood==='walking'){
      moveCat(cat,delta,25)
      if(!cat.path.length||now>=cat.until){cat.mood='sitting';cat.until=now+1400+Math.random()*2000}
    }else if(cat.mood==='returning_to_idle'){
      if(now>=cat.until)randomRest(cat,now)
    }else if(now>=cat.until)randomRest(cat,now)
  }
  // Cats never stand on top of each other. Only a roaming cat is nudged; Onay never moves.
  function separate(){
    for(let i=0;i<cats.length;i++)for(let j=i+1;j<cats.length;j++){
      const a=cats[i]!,b=cats[j]!,gap=distance(a,b)
      if(gap>=CAT_GAP||(playdate?.together&&inPlaydate(a)&&inPlaydate(b)))continue
      const ux=gap>.01?(b.x-a.x)/gap:1,uy=gap>.01?(b.y-a.y)/gap:0
      const movers=([[a,-1],[b,1]] as const).filter(([cat])=>cat.roams)
      const push=(CAT_GAP-gap)/Math.max(1,movers.length)
      for(const [cat,sign] of movers){const x=cat.x+ux*push*sign,y=cat.y+uy*push*sign;if(mascotFloorPoint(x,y,7)){cat.x=x;cat.y=y}}
    }
  }
  function tick(now:number,deltaMs:number){
    const delta=Math.min(deltaMs,50)/1000
    if(!yarn.held&&(Math.abs(yarn.vx)>1||Math.abs(yarn.vy)>1)){
      const nextX=yarn.x+yarn.vx*delta,nextY=yarn.y+yarn.vy*delta
      if(mascotFloorPoint(nextX,yarn.y,6))yarn.x=nextX;else yarn.vx*=-.36
      if(mascotFloorPoint(yarn.x,nextY,6))yarn.y=nextY;else yarn.vy*=-.36
      const drag=Math.pow(.32,delta)
      yarn.vx*=drag;yarn.vy*=drag
      if(Math.abs(yarn.vx)<1)yarn.vx=0
      if(Math.abs(yarn.vy)<1)yarn.vy=0
      stirYarn(now)
    }
    tickPlaydate(now,delta)
    for(const cat of cats)if(!inPlaydate(cat))tickCat(cat,now,delta)
    separate()
  }
  function snapshot(now:number):MascotSnapshot{
    return {cats:cats.map(cat=>({name:cat.name,x:cat.x,y:cat.y,mood:cat.mood,facing:cat.facing,purring:now<cat.petUntil})),
      yarn:{x:yarn.x,y:yarn.y,held:yarn.held,moving:Math.abs(yarn.vx)+Math.abs(yarn.vy)>2}}
  }
  function pickup(){if(yarn.held)return false;yarn.held=true;yarn.vx=0;yarn.vy=0;return true}
  function drag(x:number,y:number,now:number){if(!yarn.held||!mascotFloorPoint(x,y,6))return false;yarn.x=x;yarn.y=y;stirYarn(now);return true}
  function release(x:number,y:number,vx:number,vy:number,now:number){
    if(!yarn.held)return
    if(mascotFloorPoint(x,y,6)){yarn.x=x;yarn.y=y}
    yarn.held=false
    const magnitude=Math.hypot(vx,vy),factor=magnitude>180?180/magnitude:1
    yarn.vx=vx*factor;yarn.vy=vy*factor
    lastStimulusX=yarn.x;lastStimulusY=yarn.y
    for(const cat of cats)noticeYarn(cat,now)
  }
  function toss(now:number){
    if(yarn.held||now-lastTossAt<1800)return false
    lastTossAt=now
    const angle=(Math.random()-.5)*1.4-Math.PI/2
    yarn.vx=Math.cos(angle)*100;yarn.vy=Math.sin(angle)*100
    for(const cat of cats)noticeYarn(cat,now)
    return true
  }
  // Pets the named cat, or whichever cat is closest to the visitor.
  function pet(visitor:Point,now:number,name?:CatName):PetResult{
    const cat=name?cats.find(item=>item.name===name):cats.reduce((best,item)=>distance(visitor,item)<distance(visitor,best)?item:best)
    if(!cat||now-cat.lastPetAt<2500)return 'busy'
    if(distance(visitor,cat)>75)return 'too_far'
    if(now<cat.petUntil)return 'busy'
    if(inPlaydate(cat))endPlaydate(now)
    cat.lastPetAt=now
    cat.petUntil=now+2100;cat.until=cat.petUntil+1000;cat.path=[];cat.noticeAt=0
    cat.mood=cat.roams?'sitting':'idle'
    return 'petted'
  }
  return {tick,snapshot,pickup,drag,release,toss,pet}
}
