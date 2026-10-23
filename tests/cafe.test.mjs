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
  await writeFile(join(dir,'cafe.mjs'),compile(await readFile(new URL('../shared/cafe.ts',import.meta.url),'utf8')))
  const {scenes,isScene,isSeat,onSceneFloor,sceneLinked,arrivalSpot,cafeSeats,sceneSeats,benchSeats}=await import(pathToFileURL(join(dir,'world.mjs')).href)
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
  assert.equal(sceneSeats.store.length,0);assert.equal(sceneSeats.outside,benchSeats)
  assert.equal(isSeat(cafeSeats.length-1,'cafe'),true);assert.equal(isSeat(cafeSeats.length,'cafe'),false);assert.equal(isSeat(0,'store'),false)
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
  assert.deepEqual(cafeSeats.slice(14).map(seat=>seat.y),[300,300,300,300,300])
  assert.equal(new Set(cafeSeats.map(seat=>`${seat.x},${seat.y}`)).size,cafeSeats.length,'no two seats share a spot')
})

test('the deck sky follows the Manila clock: morning, afternoon, sunset and a moonlit night',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'chits-sky-'))
  t.after(()=>rm(dir,{recursive:true,force:true}))
  await writeFile(join(dir,'scenery.mjs'),compile(await readFile(new URL('../game/scenery.ts',import.meta.url),'utf8')))
  const {skyAt,skyPhase,sunArc,moonArc,mixColor,manilaMinute,SKY_PREVIEW}=await import(pathToFileURL(join(dir,'scenery.mjs')).href)
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
  await t.test('drinks are free, only in the café, shared with everyone there and with late joiners',async()=>{
    const fromA=mark(a),fromB=mark(b)
    for(const drink of ['espresso',null,42,{id:'hot-latte'}])a.send({type:'drink',drink})
    await quiet(b,m=>m.type==='player_drink',fromB)
    a.send({type:'drink',drink:'hot-latte'})
    assert.deepEqual(await wait(b,m=>m.type==='player_drink',fromB),{type:'player_drink',id:a.id,drink:'hot-latte'})
    await wait(a,m=>m.type==='player_drink'&&m.id===a.id,fromA)
    // Ordering again right away is too quick; after a moment the drink swaps.
    a.send({type:'drink',drink:'cappuccino'});await quiet(b,m=>m.type==='player_drink'&&m.drink==='cappuccino',fromB)
    await delay(1300);a.send({type:'drink',drink:'iced-coffee'})
    await wait(b,m=>m.type==='player_drink'&&m.drink==='iced-coffee',fromB)
    const c=await connect(cookieC,'?scene=cafe')
    assert.equal(c.inbox.find(m=>m.type==='welcome').scene,'cafe')
    assert.equal(c.inbox.find(m=>m.type==='welcome').players.find(p=>p.id===a.id).drink,'iced-coffee')
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
    // The visitor arrives empty-handed after a reconnect.
    assert.equal(back.inbox.find(m=>m.type==='welcome').players.find(p=>p.id===back.id).drink,undefined)
    Object.assign(a,back)
    const reopen=await req('/api/admin/store/status',{method:'POST',cookie:admin,body:{open:true}});assert.equal(reopen.status,200)
  })
  await t.test('leaving the café drops the drink and arrives at the café door outside',async()=>{
    const fromB=mark(b)
    b.send({type:'drink',drink:'hot-chocolate'});await wait(b,m=>m.type==='player_drink'&&m.id===b.id,fromB)
    await delay(850);b.send({type:'scene',scene:'outside'})
    const out=await wait(b,m=>m.type==='scene_changed',fromB)
    assert.equal(out.scene,'outside');assert.deepEqual([out.x,out.y],[600,300])
    assert.equal(out.players.find(p=>p.id===b.id).drink,undefined)
    b.send({type:'drink',drink:'hot-latte'});b.send({type:'act',action:'relax'})
    await quiet(b,m=>m.type==='player_drink'||m.type==='player_act',mark(b))
    // Back in, still empty-handed.
    await delay(850);const fromIn=mark(b);b.send({type:'scene',scene:'cafe'})
    const again=await wait(b,m=>m.type==='scene_changed',fromIn)
    assert.equal(again.scene,'cafe');assert.equal(again.players.find(p=>p.id===b.id).drink,undefined)
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
    // The street can't vote on, or hear, the café's music.
    c.send({type:'cafe_vote',mood:'lofi'});assert.equal((await wait(c,m=>m.type==='cafe_vote_rejected',fromC)).reason,'not_in_cafe')
    assert.equal(c.inbox.some(m=>m.type==='cafe_jukebox'),false)
    assert.equal(a.inbox.slice(fromA).some(m=>m.type==='players'&&'cafe' in m),false)
    // B leaves; the street's count follows.
    await delay(850);b.send({type:'scene',scene:'outside'})
    await wait(c,m=>m.type==='players'&&m.scene==='outside'&&m.cafe===1,fromC)
  })
})
