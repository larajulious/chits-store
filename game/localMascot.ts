import { mascotFloorPoint, type CatMood, type MascotSnapshot } from '../shared/store-mascot'

type Point={x:number;y:number}
type PetResult='petted'|'too_far'|'busy'
const spots:Point[]=[{x:100,y:290},{x:180,y:280},{x:310,y:300},{x:190,y:360},{x:170,y:440},{x:90,y:460},{x:260,y:440},{x:210,y:500},{x:320,y:440}]
const pick=<T>(values:T[]):T=>values[Math.floor(Math.random()*values.length)]!
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y)
const key=(point:Point)=>`${point.x},${point.y}`

// One instance belongs to one Phaser scene. No timers, network, Vue state, or persistence.
export function createLocalMascot(){
  const cat={x:100,y:290,mood:'sitting' as CatMood,facing:1 as -1|1,until:2500,path:[] as Point[],pathTarget:null as Point|null,lastPlayAt:0,petUntil:0,lastRouteAt:0}
  const yarn={x:175,y:440,vx:0,vy:0,held:false}
  let noticeAt=0,lastStimulusX=yarn.x,lastStimulusY=yarn.y,lastTossAt=-Infinity,lastPetAt=-Infinity

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
  function setRoute(target:Point,mood:CatMood,now:number){
    cat.path=route(cat,target);cat.pathTarget={...target};cat.mood=cat.path.length?mood:'sitting';cat.lastRouteAt=now
  }
  function randomRest(now:number){
    const choice=Math.random()
    if(choice<.39){setRoute(pick(spots),'walking',now);cat.until=now+13_000}
    else if(choice<.60){cat.mood='sitting';cat.until=now+2800+Math.random()*4300}
    else if(choice<.78){cat.mood='resting';cat.until=now+3500+Math.random()*4500}
    else if(choice<.91){cat.mood='sleeping';cat.until=now+5000+Math.random()*7000}
    else{cat.mood='stretching';cat.until=now+1300+Math.random()*800}
  }
  function sightClear(from:Point,to:Point){
    const steps=Math.max(2,Math.ceil(distance(from,to)/12))
    for(let i=1;i<steps;i++){const fraction=i/steps;if(!mascotFloorPoint(from.x+(to.x-from.x)*fraction,from.y+(to.y-from.y)*fraction))return false}
    return true
  }
  function noticeYarn(now:number){
    const target={x:yarn.x,y:yarn.y},gap=distance(cat,target)
    if(gap>175&&(gap>230||!sightClear(cat,target)))return
    if(cat.mood==='playing_with_yarn'||cat.mood==='noticing_yarn'||cat.mood==='approaching_yarn'){
      if(cat.mood==='approaching_yarn'&&cat.pathTarget&&distance(cat.pathTarget,target)>28&&now-cat.lastRouteAt>300)setRoute(target,'approaching_yarn',now)
      return
    }
    if(Math.random()<(cat.mood==='sleeping'?.30:.12))return
    noticeAt=now+400+Math.random()*(cat.mood==='sleeping'?2800:1500)
  }
  function stirYarn(now:number){
    if(distance({x:lastStimulusX,y:lastStimulusY},yarn)<12)return
    lastStimulusX=yarn.x;lastStimulusY=yarn.y;noticeYarn(now)
  }
  function moveCat(delta:number,speed:number){
    const next=cat.path[0]
    if(!next)return
    if(Math.abs(next.x-cat.x)>1)cat.facing=next.x>cat.x?1:-1
    const gap=distance(cat,next),step=Math.min(gap,speed*delta)
    if(gap<=step+.001){cat.x=next.x;cat.y=next.y;cat.path.shift()}
    else{cat.x+=(next.x-cat.x)/gap*step;cat.y+=(next.y-cat.y)/gap*step}
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
      if(!noticeAt)stirYarn(now)
    }
    if(now<cat.petUntil){cat.mood='sitting';cat.path=[];return}
    if(noticeAt&&now>=noticeAt){noticeAt=0;cat.mood='noticing_yarn';cat.facing=yarn.x>=cat.x?1:-1;cat.until=now+700+Math.random()*500;cat.path=[]}
    if(cat.mood==='noticing_yarn'&&now>=cat.until){
      if(distance(cat,yarn)<25){cat.mood='playing_with_yarn';cat.until=now+2500+Math.random()*2100;cat.lastPlayAt=now}
      else{setRoute(yarn,'approaching_yarn',now);cat.until=now+8000}
    }
    if(cat.mood==='approaching_yarn'){
      if(cat.pathTarget&&distance(cat.pathTarget,yarn)>32&&now-cat.lastRouteAt>300)setRoute(yarn,'approaching_yarn',now)
      moveCat(delta,54)
      if(distance(cat,yarn)<20||(!cat.path.length&&distance(cat,yarn)<31)){
        cat.mood='playing_with_yarn';cat.path=[];cat.until=now+2500+Math.random()*2100;cat.lastPlayAt=now
      }else if(now>=cat.until){cat.mood='returning_to_idle';cat.until=now+1000}
    }else if(cat.mood==='playing_with_yarn'){
      if(now-cat.lastPlayAt>800&&!yarn.held){cat.lastPlayAt=now;const angle=Math.random()*Math.PI*2;yarn.vx=Math.cos(angle)*55;yarn.vy=Math.sin(angle)*55}
      const gap=distance(cat,yarn)
      if(gap>18&&gap<65){const step=Math.min(gap-18,24*delta),x=cat.x+(yarn.x-cat.x)/gap*step,y=cat.y+(yarn.y-cat.y)/gap*step;if(mascotFloorPoint(x,y,7)){cat.x=x;cat.y=y}}
      if(now>=cat.until){cat.mood='sitting';cat.until=now+1800+Math.random()*2100}
    }else if(cat.mood==='walking'){
      moveCat(delta,25)
      if(!cat.path.length||now>=cat.until){cat.mood='sitting';cat.until=now+1400+Math.random()*2000}
    }else if(cat.mood==='returning_to_idle'){
      if(now>=cat.until)randomRest(now)
    }else if(now>=cat.until)randomRest(now)
  }
  function snapshot(now:number):MascotSnapshot{
    return {cat:{x:cat.x,y:cat.y,mood:cat.mood,facing:cat.facing,purring:now<cat.petUntil},yarn:{x:yarn.x,y:yarn.y,held:yarn.held,moving:Math.abs(yarn.vx)+Math.abs(yarn.vy)>2}}
  }
  function pickup(){if(yarn.held)return false;yarn.held=true;yarn.vx=0;yarn.vy=0;return true}
  function drag(x:number,y:number,now:number){if(!yarn.held||!mascotFloorPoint(x,y,6))return false;yarn.x=x;yarn.y=y;stirYarn(now);return true}
  function release(x:number,y:number,vx:number,vy:number,now:number){
    if(!yarn.held)return
    if(mascotFloorPoint(x,y,6)){yarn.x=x;yarn.y=y}
    yarn.held=false
    const magnitude=Math.hypot(vx,vy),factor=magnitude>180?180/magnitude:1
    yarn.vx=vx*factor;yarn.vy=vy*factor
    lastStimulusX=yarn.x;lastStimulusY=yarn.y;noticeYarn(now)
  }
  function toss(now:number){
    if(yarn.held||now-lastTossAt<1800)return false
    lastTossAt=now
    const angle=(Math.random()-.5)*1.4-Math.PI/2
    yarn.vx=Math.cos(angle)*100;yarn.vy=Math.sin(angle)*100;noticeYarn(now)
    return true
  }
  function pet(visitor:Point,now:number):PetResult{
    if(now-lastPetAt<2500)return 'busy'
    if(distance(visitor,cat)>75)return 'too_far'
    if(now<cat.petUntil)return 'busy'
    lastPetAt=now
    cat.petUntil=now+2100;cat.mood='sitting';cat.until=cat.petUntil+1000;cat.path=[];noticeAt=0
    return 'petted'
  }
  return {tick,snapshot,pickup,drag,release,toss,pet}
}
