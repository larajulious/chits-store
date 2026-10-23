import {test} from 'node:test'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {randomBytes,scryptSync} from 'node:crypto'
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createServer} from 'node:http'
import {once} from 'node:events'
import ts from 'typescript'
import WebSocket from 'ws'

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText

test('Kape & Chits joins the world: linked doors, arrival spots and café seats',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'chits-cafe-world-'))
  t.after(()=>rm(dir,{recursive:true,force:true}))
  await writeFile(join(dir,'world.mjs'),compile(await readFile(new URL('../shared/world.ts',import.meta.url),'utf8')))
  await writeFile(join(dir,'cafe.mjs'),compile(await readFile(new URL('../shared/cafe.ts',import.meta.url),'utf8')).replace("from './world'","from './world.mjs'"))
  const {scenes,isScene,isSeat,onSceneFloor,sceneLinked,arrivalSpot,cafeSeats,sceneSeats,benchSeats,storeSeats,sceneBins,nearBin,jeepneySeats}=await import(pathToFileURL(join(dir,'world.mjs')).href)
  const {drinkOptions,isDrink,isCafeAction,conversationStarters,cafeMoods,isCafeMood,chooseCafeMood}=await import(pathToFileURL(join(dir,'cafe.mjs')).href)
  assert.equal(isScene('cafe'),true)
  assert.equal(onSceneFloor('cafe',scenes.cafe.spawn.x,scenes.cafe.spawn.y),true)
  // The café opens onto the street only; the store and café are not connected directly.
  assert.equal(sceneLinked('outside','cafe'),true);assert.equal(sceneLinked('cafe','outside'),true)
  assert.equal(sceneLinked('store','cafe'),false);assert.equal(sceneLinked('cafe','store'),false)
  // Leaving the café puts the visitor on the pavement in front of the café door; leaving the store, by the store door.
  assert.deepEqual(arrivalSpot('outside','cafe'),{x:600,y:300});assert.deepEqual(arrivalSpot('outside','store'),scenes.outside.spawn)
  assert.equal(onSceneFloor('outside',600,300),true)
  // Seats sit on the floor and on the 20-unit walking grid, and are counted per scene.
  assert.ok(cafeSeats.length>=6)
  for(const seat of cafeSeats){assert.equal(onSceneFloor('cafe',seat.x,seat.y),true);assert.equal(seat.x%20,0);assert.equal(seat.y%20,0)}
  assert.equal(sceneSeats.outside,benchSeats)
  assert.equal(isSeat(cafeSeats.length-1,'cafe'),true);assert.equal(isSeat(cafeSeats.length,'cafe'),false)
  // A jeepney is boarded from the street only, and drops its riders in front of the store; its bench is its floor.
  assert.equal(sceneLinked('outside','jeepney'),true);assert.equal(sceneLinked('store','jeepney'),false);assert.equal(sceneLinked('jeepney','cafe'),false)
  assert.deepEqual(arrivalSpot('outside','jeepney'),scenes.outside.spawn)
  assert.equal(jeepneySeats.length,7);for(const seat of jeepneySeats)assert.equal(onSceneFloor('jeepney',seat.x,seat.y),true)
  // The store's deck matches the café's: its benches and railing spots are the same places as theirs.
  assert.equal(sceneSeats.store,storeSeats);assert.deepEqual(storeSeats,[...cafeSeats.slice(8,12),...cafeSeats.slice(14,19)])
  assert.equal(isSeat(8,'store'),true);assert.equal(isSeat(9,'store'),false)
  // Bins: one on the street, two in the café, one on the store's deck; each stand spot is on its scene's floor.
  for(const [scene,bins] of Object.entries(sceneBins))for(const bin of bins){assert.equal(onSceneFloor(scene,bin.standX,bin.standY),true);assert.equal(nearBin(scene,bin.standX,bin.standY),true)}
  assert.deepEqual(Object.values(sceneBins).map(bins=>bins.length),[1,0,1,2]);assert.equal(nearBin('store',180,510),false)
  assert.equal(isSeat(benchSeats.length),false,'the bench stays the default')
  assert.deepEqual(drinkOptions.map(d=>d.label),['Iced Coffee','Hot Latte','Cappuccino','Hot Chocolate'])
  assert.equal(isDrink('hot-latte'),true);assert.equal(isDrink('espresso'),false);assert.equal(isDrink({}),false)
  assert.equal(isCafeAction('sip'),true);assert.equal(isCafeAction('dance'),false)
  assert.ok(conversationStarters.includes('Kumusta araw mo?'))
  assert.deepEqual(cafeMoods.map(m=>m.label),['Relaxing Café','Lo-fi Chill','Rainy Coffee Shop'])
  assert.equal(isCafeMood('rain'),true);assert.equal(isCafeMood('off'),false)
  // The next set: most votes (the current mood may win again); otherwise the mood that has waited longest.
  assert.equal(chooseCafeMood({cafe:0,lofi:0,rain:0},{cafe:300,lofi:100,rain:200}),'lofi')
  assert.equal(chooseCafeMood({cafe:2,lofi:0,rain:1},{cafe:300,lofi:100}),'cafe')
  assert.equal(chooseCafeMood({cafe:0,lofi:1,rain:1},{lofi:100}),'rain')
  // The Tanaw Deck beside the café: the room spans both, and the deck has benches, a table and five railing spots.
  assert.equal(scenes.cafe.width,720);assert.equal(onSceneFloor('cafe',660,300),true);assert.equal(onSceneFloor('cafe',710,300),false)
  assert.equal(cafeSeats.filter(seat=>seat.x>360).length,11)
  assert.deepEqual(cafeSeats.slice(14,19).map(seat=>seat.y),[300,300,300,300,300])
  // The CR by the front door is the last seat.
  assert.deepEqual(cafeSeats[cafeSeats.length-1],{x:80,y:540})
  assert.equal(new Set(cafeSeats.map(seat=>`${seat.x},${seat.y}`)).size,cafeSeats.length,'no two seats share a spot')
})

test('the deck sky follows the Manila clock: morning, afternoon, sunset and a moonlit night',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'chits-sky-'))
  t.after(()=>rm(dir,{recursive:true,force:true}))
  await writeFile(join(dir,'scenery.mjs'),compile(await readFile(new URL('../game/scenery.ts',import.meta.url),'utf8')))
  await writeFile(join(dir,'world.mjs'),compile(await readFile(new URL('../shared/world.ts',import.meta.url),'utf8')))
  await writeFile(join(dir,'traffic.mjs'),compile(await readFile(new URL('../shared/traffic.ts',import.meta.url),'utf8')).replace("from './world'","from './world.mjs'"))
  const {skyAt,skyPhase,sunArc,moonArc,mixColor,manilaMinute,SKY_PREVIEW,volcanoSmoke,SMOKE_WINDOW_MS}=await import(pathToFileURL(join(dir,'scenery.mjs')).href)
  const {trafficAt,jeepneyAtStop,JEEPNEY_STOP}=await import(pathToFileURL(join(dir,'traffic.mjs')).href)
  assert.deepEqual([450,840,1065,1290,120].map(skyPhase),['morning','afternoon','sunset','night','night'])
  for(const [name,minute] of Object.entries(SKY_PREVIEW))assert.ok(Number.isInteger(minute)&&minute>=0&&minute<1440,name)
  // Every minute of the day blends to a valid sky; neighbouring minutes barely differ, so the change is gradual.
  const channels=color=>[color>>16&255,color>>8&255,color&255]
  let previous=skyAt(1439)
  for(let minute=0;minute<1440;minute++){
    const sky=skyAt(minute)
    for(const key of ['top','mid','horizon','far','island','lake','near','glow']){
      assert.ok(Number.isInteger(sky[key])&&sky[key]>=0&&sky[key]<=0xffffff,`${key} at ${minute}`)
      for(const [a,b] of channels(sky[key]).map((c,i)=>[c,channels(previous[key])[i]]))assert.ok(Math.abs(a-b)<=12,`${key} jumps at ${minute}`)
    }
    for(const key of ['warmth','dark','lights','stars','fog'])assert.ok(sky[key]>=0&&sky[key]<=1,`${key} at ${minute}`)
    previous=sky
  }
  // Sunset is the warm peak; night has stars, lamps and no sun; midday has neither.
  assert.equal(skyAt(1070).warmth,1);assert.equal(skyAt(720).lights,0);assert.equal(skyAt(720).stars,0)
  assert.equal(skyAt(1290).stars,1);assert.equal(skyAt(1290).lights,1)
  assert.equal(sunArc(1290),undefined);assert.ok(moonArc(1290)>0&&moonArc(1290)<1)
  assert.ok(sunArc(720)>.4&&sunArc(720)<.6);assert.equal(moonArc(720),undefined)
  assert.equal(mixColor(0x000000,0xffffff,.5),0x808080)
  // The volcano steams only sometimes: a plume in some windows, never sudden, the same for every device at the same time.
  const day=Date.UTC(2026,9,23),step=2000,samples=[]
  for(let now=day;now<day+86_400_000;now+=step)samples.push(volcanoSmoke(now))
  const smoking=samples.filter(value=>value>0).length/samples.length
  assert.ok(smoking>.08&&smoking<.4,`smoke ${Math.round(smoking*100)}% of the day`)
  assert.ok(samples.every(value=>value>=0&&value<=1));assert.ok(samples.some(value=>value===1))
  for(let i=1;i<samples.length;i++)assert.ok(Math.abs(samples[i]-samples[i-1])<=.26,'the plume eases in and out')
  const windows=new Set();for(let now=day;now<day+86_400_000;now+=SMOKE_WINDOW_MS/10)if(volcanoSmoke(now)>0)windows.add(Math.floor(now/SMOKE_WINDOW_MS))
  assert.ok(windows.size>40&&windows.size<240,`${windows.size} windows with a plume`)
  // Traffic on the street: only now and then, each pass crossing the whole road. Cars and tricycles go both ways;
  // jeepneys come along the near lane and wait at the stop, which is when visitors can board.
  const passes=new Map()
  for(let now=day;now<day+86_400_000;now+=250){
    const pass=trafficAt(now)
    if(!pass)continue
    const seen=passes.get(pass.id)
    passes.set(pass.id,{...pass,first:seen?.first??pass.x,last:pass.x,stopped:seen?.stopped||pass.stopped,stops:new Set([...(seen?.stops??[]),...(pass.stopped?[pass.x]:[])])})
  }
  const vehicles=[...passes.values()]
  assert.ok(vehicles.length>1500&&vehicles.length<4300,`${vehicles.length} vehicles a day`)
  assert.deepEqual(new Set(vehicles.map(p=>p.kind)),new Set(['car','jeepney','tricycle']))
  const jeepneys=vehicles.filter(p=>p.kind==='jeepney'),others=vehicles.filter(p=>p.kind!=='jeepney')
  assert.ok(jeepneys.length>600,'plenty of jeepneys to catch')
  assert.ok(jeepneys.every(p=>p.rightward&&p.stopped&&p.stops.size===1&&p.stops.has(JEEPNEY_STOP.x)),'every jeepney waits at the stop')
  assert.ok(others.every(p=>!p.stopped));assert.deepEqual(new Set(others.map(p=>p.rightward)),new Set([true,false]))
  assert.ok(vehicles.every(p=>Math.abs(p.first-p.last)>1600),'each one drives all the way across')
  // The server's boarding check: a jeepney waiting at the stop (with a moment's grace either side).
  const waiting=[];for(let now=day;now<day+3_600_000;now+=1000)if(jeepneyAtStop(now))waiting.push(now)
  assert.ok(waiting.length>200,`${waiting.length}s of jeepney waiting an hour`)
  assert.ok(waiting.every(now=>trafficAt(now).stopped))
  // 15:30 UTC is 23:30 in Manila (no daylight saving).
  assert.equal(manilaMinute(new Date('2026-10-23T15:30:00Z')),23*60+30)
})

test('the café is one shared, always-open room with seats, drinks, actions and safe chat',{timeout:90_000},async t=>{
  const dir=await mkdtemp(join(tmpdir(),'chits-cafe-')),sqlite=join(dir,'test.sqlite')
  const reserve=createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening')
  const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve))
  const base=`http://127.0.0.1:${port}`,password=randomBytes(24).toString('hex'),salt=randomBytes(16).toString('hex')
  const env={...process.env,NODE_ENV:'production',CAFE_SET_SECONDS:'6',NITRO_HOST:'127.0.0.1',NITRO_PORT:String(port),SQLITE_PATH:sqlite,SESSION_SECRET:randomBytes(32).toString('hex'),ADMIN_PASSWORD_HASH:`${salt}:${scryptSync(password,salt,64).toString('hex')}`,PUBLIC_ORIGIN:base}
  const child=spawn(process.execPath,['.output/server/index.mjs'],{cwd:new URL('..',import.meta.url),env,stdio:['ignore','pipe','pipe']})
  let logs='';child.stdout.on('data',d=>{logs+=d});child.stderr.on('data',d=>{logs+=d})
  const peers=[]
  t.after(async()=>{for(const peer of peers)peer.ws.terminate();if(child.exitCode===null){const ended=once(child,'exit');child.kill();await ended}await rm(dir,{recursive:true,force:true});assert.doesNotMatch(logs,/\[uncaughtException\]|\[unhandledRejection\]/)})
  const req=(path,{method='GET',cookie,body}={})=>fetch(base+path,{method,headers:{...(method==='GET'?{}:{Origin:base,'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)})
  for(let i=0;i<100;i++){try{if((await req('/api/store/status')).ok)break}catch{}if(i===99)assert.fail('Server did not start');await delay(40)}
  async function visitor(avatar){const r=await req('/api/visitors/join',{method:'POST',body:{avatar}});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0]}
  async function connect(cookie,query=''){
    const ws=new WebSocket(`${base.replace('http','ws')}/ws${query}`,{headers:{Cookie:cookie,Origin:base}})
    const peer={ws,inbox:[],send:data=>ws.send(JSON.stringify(data))};peers.push(peer)
    ws.on('message',d=>peer.inbox.push(JSON.parse(String(d))));ws.on('error',()=>{})
    await once(ws,'open');peer.id=(await wait(peer,m=>m.type==='welcome')).selfId;return peer
  }
  async function wait(peer,predicate,from=0,tries=300){
    for(let i=0;i<tries;i++){const found=peer.inbox.slice(from).find(predicate);if(found)return found;await delay(10)}
    throw new Error('Expected room event missing')
  }
  const mark=peer=>peer.inbox.length
  const quiet=async(peer,predicate,from,ms=250)=>{await delay(ms);assert.equal(peer.inbox.slice(from).some(predicate),false)}
  // Walk in steps the server believes (it caps speed), waiting between them.
  async function walk(peer,points){for(const [x,y] of points){peer.send({type:'move',x,y});await delay(320)}}
  async function login(){const r=await req('/api/admin/login',{method:'POST',body:{password}});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0]}

  const cookieA=await visitor('mochi'),cookieB=await visitor('boba'),cookieC=await visitor('puto')
  const a=await connect(cookieA),b=await connect(cookieB)
  await t.test('the café is reached from the street, never straight from the store',async()=>{
    const fromA=mark(a)
    a.send({type:'scene',scene:'cafe'})
    assert.equal((await wait(a,m=>m.type==='scene_rejected',fromA)).scene,'store')
    await delay(850)
    a.send({type:'scene',scene:'outside'});await wait(a,m=>m.type==='scene_changed'&&m.scene==='outside',fromA)
    await delay(850)
    const toCafe=mark(a)
    a.send({type:'scene',scene:'cafe'})
    const inside=await wait(a,m=>m.type==='scene_changed',toCafe)
    assert.equal(inside.scene,'cafe');assert.deepEqual([inside.x,inside.y],[180,510]);assert.deepEqual(inside.players.map(p=>p.id),[a.id])
    // B joins over the street; both share one café room and its presence list.
    const fromB=mark(b)
    b.send({type:'scene',scene:'outside'});await wait(b,m=>m.type==='scene_changed'&&m.scene==='outside',fromB)
    await delay(850);b.send({type:'scene',scene:'cafe'})
    const joined=await wait(b,m=>m.type==='scene_changed'&&m.scene==='cafe',fromB)
    assert.deepEqual(joined.players.map(p=>p.id).sort(),[a.id,b.id].sort())
    await wait(a,m=>m.type==='players'&&m.scene==='cafe'&&m.players.length===2&&m.online===2,toCafe)
  })
  await t.test('the café jukebox is one timeline for everyone inside, and votes pick the next set',async()=>{
    // Each visitor got the timeline on walking in, never before (the store and street don't hear it).
    for(const peer of [a,b]){
      const inside=peer.inbox.findIndex(m=>m.type==='scene_changed'&&m.scene==='cafe')
      assert.equal(peer.inbox.slice(0,inside).some(m=>m.type==='cafe_jukebox'),false)
      assert.ok(peer.inbox.slice(inside).some(m=>m.type==='cafe_jukebox'&&m.state.endsAt-m.state.startedAt===6000))
    }
    // Vote early in a fresh set, so the round can't close mid-test.
    const fresh=await wait(a,m=>m.type==='cafe_jukebox'&&m.state.serverNow<m.state.startedAt,mark(a),900)
    const {round}=fresh.state,fromA=mark(a),fromB=mark(b)
    a.send({type:'cafe_vote',mood:'off',round});a.send({type:'cafe_vote',mood:'rain',round:round-1})
    assert.equal((await wait(a,m=>m.type==='cafe_vote_rejected',fromA)).reason,'round_closed')
    await delay(450);a.send({type:'cafe_vote',mood:'rain',round});b.send({type:'cafe_vote',mood:'rain',round})
    assert.deepEqual(await wait(a,m=>m.type==='cafe_vote_ok',fromA),{type:'cafe_vote_ok',round,mood:'rain'})
    const tallied=await wait(b,m=>m.type==='cafe_jukebox'&&m.state.votes.rain===2,fromB)
    assert.equal(tallied.state.upNext,'rain')
    // When the set ends, both hear the rainy mood from the same moment.
    const [nextA,nextB]=await Promise.all([a,b].map(peer=>wait(peer,m=>m.type==='cafe_jukebox'&&m.state.round===round+1,peer===a?fromA:fromB,900)))
    assert.equal(nextA.state.mood,'rain');assert.equal(nextA.state.startedAt,nextB.state.startedAt)
    assert.deepEqual(nextA.state.votes,{cafe:0,lofi:0,rain:0})
  })
  await t.test('café drinks are free, one at a time, shared with everyone there and with late joiners',async()=>{
    const fromA=mark(a),fromB=mark(b)
    for(const drink of ['espresso',null,42,{id:'hot-latte'}])a.send({type:'drink',drink})
    await quiet(b,m=>m.type==='player_drink',fromB)
    a.send({type:'drink',drink:'hot-latte'})
    assert.deepEqual(await wait(b,m=>m.type==='player_drink',fromB),{type:'player_drink',id:a.id,drink:'hot-latte'})
    await wait(a,m=>m.type==='player_drink'&&m.id===a.id,fromA)
    // One at a time: another drink is refused until this one goes in a bin. Cold cans come from the street's machine.
    await delay(1600);a.send({type:'drink',drink:'cappuccino'})
    assert.equal((await wait(a,m=>m.type==='drink_rejected',fromA)).reason,'hands_full')
    await quiet(b,m=>m.type==='player_drink'&&m.drink==='cappuccino',fromB)
    const c=await connect(cookieC,'?scene=cafe')
    assert.equal(c.inbox.find(m=>m.type==='welcome').scene,'cafe')
    assert.equal(c.inbox.find(m=>m.type==='welcome').players.find(p=>p.id===a.id).drink,'hot-latte')
    c.ws.terminate();await wait(a,m=>m.type==='players'&&m.players.length===2,fromA)
  })
  await t.test('sip needs a drink; sip and relax reach the café only',async()=>{
    const fromA=mark(a),fromB=mark(b)
    b.send({type:'act',action:'sip'});await quiet(a,m=>m.type==='player_act',fromA)
    b.send({type:'act',action:'relax'})
    assert.deepEqual(await wait(a,m=>m.type==='player_act',fromA),{type:'player_act',id:b.id,action:'relax'})
    await delay(850);a.send({type:'act',action:'sip'})
    assert.deepEqual(await wait(b,m=>m.type==='player_act'&&m.id===a.id,fromB),{type:'player_act',id:a.id,action:'sip'})
    await delay(850);for(const action of ['dance','',null])a.send({type:'act',action})
    await quiet(b,m=>m.type==='player_act'&&m.id===a.id&&m.action!=='sip',fromB)
  })
  await t.test('one visitor per seat; a disconnect frees the seat',async()=>{
    const fromA=mark(a),fromB=mark(b)
    a.send({type:'sit',seat:0});await wait(a,m=>m.type==='sit_rejected'&&m.seat===0,fromA)
    await walk(a,[[150,450],[120,400],[80,360]])
    a.send({type:'sit',seat:0})
    assert.deepEqual(await wait(b,m=>m.type==='player_pose'&&m.id===a.id,fromB),{type:'player_pose',id:a.id,pose:'sit',seat:0})
    await walk(b,[[150,450],[110,400],[100,364]])
    b.send({type:'sit',seat:0});await wait(b,m=>m.type==='sit_rejected'&&m.seat===0,fromB)
    b.send({type:'sit',seat:1});await wait(a,m=>m.type==='player_pose'&&m.id===b.id&&m.seat===1,fromA)
    for(const seat of [-1,99,'1',null])b.send({type:'sit',seat})
    await wait(b,m=>m.type==='sit_rejected'&&m.seat===undefined,fromB)
    // A drops; their seat is free again for B.
    a.ws.terminate()
    await wait(b,m=>m.type==='players'&&m.players.length===1,fromB)
    await walk(b,[[80,360]])
    const fromSeat=mark(b)
    b.send({type:'sit',seat:0})
    await wait(b,m=>m.type==='player_pose'&&m.id===b.id&&m.seat===0,fromSeat)
  })
  await t.test('closing the store leaves the café open, and reconnects stay in the café',async()=>{
    const admin=await login()
    const fromB=mark(b)
    const close=await req('/api/admin/store/status',{method:'POST',cookie:admin,body:{open:false}});assert.equal(close.status,200)
    await wait(b,m=>m.type==='store_status'&&m.open===false,fromB)
    await quiet(b,m=>m.type==='scene_changed',fromB,150)
    const back=await connect(cookieA,'?scene=cafe')
    assert.equal(back.inbox.find(m=>m.type==='welcome').scene,'cafe')
    assert.deepEqual(back.inbox.find(m=>m.type==='welcome').players.map(p=>p.id).sort(),[back.id,b.id].sort())
    // A refresh or reconnect keeps the drink in hand.
    assert.equal(back.inbox.find(m=>m.type==='welcome').players.find(p=>p.id===back.id).drink,'hot-latte')
    Object.assign(a,back)
    const reopen=await req('/api/admin/store/status',{method:'POST',cookie:admin,body:{open:true}});assert.equal(reopen.status,200)
  })
  await t.test('drinks go everywhere with their holder; a cold can needs empty hands; only a bin lets go',async()=>{
    const fromB=mark(b)
    b.send({type:'drink',drink:'hot-chocolate'});await wait(b,m=>m.type==='player_drink'&&m.id===b.id,fromB)
    await delay(850);b.send({type:'scene',scene:'outside'})
    const out=await wait(b,m=>m.type==='scene_changed',fromB)
    assert.equal(out.scene,'outside');assert.deepEqual([out.x,out.y],[600,300])
    assert.equal(out.players.find(p=>p.id===b.id).drink,'hot-chocolate')
    // Hands full: no can from the machine. Relaxing is the café's, but a sip works anywhere.
    const outside=mark(b)
    await delay(1600);b.send({type:'drink',drink:'buko'})
    assert.equal((await wait(b,m=>m.type==='drink_rejected',outside)).reason,'hands_full')
    b.send({type:'act',action:'relax'});await quiet(b,m=>m.type==='player_act',outside)
    await delay(850);b.send({type:'act',action:'sip'})
    assert.deepEqual(await wait(b,m=>m.type==='player_act',outside),{type:'player_act',id:b.id,action:'sip'})
    // The drink only goes from beside a bin: here, the one by the bench.
    b.send({type:'trash'});await wait(b,m=>m.type==='trash_rejected',outside)
    await walk(b,[[530,300],[460,300],[390,300],[320,300],[250,300],[180,300],[140,300],[100,300]])
    b.send({type:'trash'})
    assert.deepEqual(await wait(b,m=>m.type==='player_drink'&&m.id===b.id,outside),{type:'player_drink',id:b.id,drink:null})
    // Empty-handed: a cold can (real flavours only; café drinks come from the barista), carried back into the café.
    const empty=mark(b)
    for(const drink of ['ube','hot-latte'])b.send({type:'drink',drink})
    await quiet(b,m=>m.type==='player_drink',empty)
    b.send({type:'drink',drink:'buko'})
    assert.deepEqual(await wait(b,m=>m.type==='player_drink',empty),{type:'player_drink',id:b.id,drink:'buko'})
    await delay(850);const fromIn=mark(b);b.send({type:'scene',scene:'cafe'})
    const again=await wait(b,m=>m.type==='scene_changed',fromIn)
    assert.equal(again.scene,'cafe');assert.equal(again.players.find(p=>p.id===b.id).drink,'buko')
  })
  await t.test('repeated lines are refused; reports reach staff once per visitor',async()=>{
    await delay(1600)
    const fromA=mark(a),fromB=mark(b)
    a.send({type:'chat',text:'Kumusta araw mo?'})
    const line=await wait(b,m=>m.type==='chat'&&m.text==='Kumusta araw mo?',fromB)
    assert.equal(line.scene,'cafe');assert.equal('reports' in line,false)
    await delay(1600);a.send({type:'chat',text:'kumusta araw mo?'})
    await wait(a,m=>m.type==='chat_repeat',fromA)
    // Reporting your own line, staff lines or unknown ids does nothing; a real report is counted once.
    a.send({type:'report',messageId:line.messageId});await wait(a,m=>m.type==='report_rejected',fromA)
    b.send({type:'report',messageId:'nope'});await wait(b,m=>m.type==='report_rejected',fromB)
    b.send({type:'report',messageId:line.messageId});await wait(b,m=>m.type==='report_ok',fromB)
    b.send({type:'report',messageId:line.messageId});await delay(100)
    const admin=await login()
    const state=await req('/api/admin/chat',{cookie:admin}).then(r=>r.json())
    assert.equal(state.messages.find(m=>m.messageId===line.messageId).reports,1)
    // Visitors never see the counts.
    assert.equal(a.inbox.slice(fromA).some(m=>'reports' in m),false)
    const room=await req('/api/admin/room',{cookie:admin}).then(r=>r.json())
    assert.deepEqual(room.members.map(m=>m.scene),['cafe','cafe'])
  })
  await t.test('out on the deck: leaning on the railing is a seat, and the street only hears how many are inside',async()=>{
    const fromA=mark(a)
    await walk(b,[[240,500],[300,460],[360,420],[420,380],[420,320],[420,300]])
    b.send({type:'sit',seat:14})
    assert.deepEqual(await wait(a,m=>m.type==='player_pose'&&m.id===b.id&&m.seat===14,fromA),{type:'player_pose',id:b.id,pose:'sit',seat:14})
    const c=await connect(cookieC),fromC=mark(c)
    c.send({type:'scene',scene:'outside'})
    await wait(c,m=>m.type==='players'&&m.scene==='outside'&&m.cafe===2,fromC)
    assert.equal(c.inbox.some(m=>m.type==='players'&&m.players.some(p=>p.id===a.id||p.id===b.id)),false)
    // The street hears only the café's mood (its weather: rain for the rainy mood), never the timeline or the votes.
    assert.ok(['cafe','lofi','rain'].includes((await wait(c,m=>m.type==='cafe_mood',fromC)).mood))
    // Boarding: never from the store; from the street only beside a jeepney waiting at the stop (C is by the store door).
    await delay(850);c.send({type:'scene',scene:'jeepney'})
    assert.ok(['no_jeepney','too_far'].includes((await wait(c,m=>m.type==='scene_rejected'&&m.reason,fromC)).reason))
    // The street can't vote on, or hear, the café's music.
    c.send({type:'cafe_vote',mood:'lofi'});assert.equal((await wait(c,m=>m.type==='cafe_vote_rejected',fromC)).reason,'not_in_cafe')
    assert.equal(c.inbox.some(m=>m.type==='cafe_jukebox'),false)
    assert.equal(a.inbox.slice(fromA).some(m=>m.type==='players'&&'cafe' in m),false)
    // The CR is one visitor at a time, and the server lets them out a few seconds after the game would have.
    const fromCr=mark(a)
    await walk(a,[[140,520],[80,540]])
    a.send({type:'sit',seat:19})
    await wait(a,m=>m.type==='player_pose'&&m.id===a.id&&m.seat===19,fromCr)
    assert.deepEqual(await wait(a,m=>m.type==='player_pose'&&m.id===a.id&&m.pose==='stand',fromCr,1100),{type:'player_pose',id:a.id,pose:'stand'})
    // The store has a deck too: from the store's door, through its side doorway, to lean on its railing.
    const cookieD=await visitor('maja'),d=await connect(cookieD),fromD=mark(d)
    await walk(d,[[220,460],[260,410],[300,360],[340,320],[380,300],[420,300]])
    d.send({type:'sit',seat:4})
    assert.deepEqual(await wait(d,m=>m.type==='player_pose'&&m.id===d.id,fromD),{type:'player_pose',id:d.id,pose:'sit',seat:4})
    d.ws.terminate()
    // B leaves; the street's count follows.
    await delay(850);b.send({type:'scene',scene:'outside'})
    await wait(c,m=>m.type==='players'&&m.scene==='outside'&&m.cafe===1,fromC)
  })
})
