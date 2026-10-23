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

test('scene floors, spawns and bench seats agree with each other',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'chits-world-'))
  t.after(()=>rm(dir,{recursive:true,force:true}))
  await writeFile(join(dir,'world.mjs'),compile(await readFile(new URL('../shared/world.ts',import.meta.url),'utf8')))
  const {scenes,isScene,onSceneFloor,benchSeats,isSeat,vendingProducts}=await import(pathToFileURL(join(dir,'world.mjs')).href)
  assert.deepEqual(Object.keys(scenes),['store','outside','cafe','jeepney'])
  for(const [id,scene] of Object.entries(scenes))assert.equal(onSceneFloor(id,scene.spawn.x,scene.spawn.y),true,`${id} spawn is walkable`)
  // The store's floor runs on through a doorway onto its deck.
  assert.deepEqual(scenes.store.floor,{minX:20,maxX:700,minY:260,maxY:542},'the room, then its deck through the side doorway')
  assert.equal(onSceneFloor('store',600,300),true);assert.equal(onSceneFloor('store',710,300),false)
  assert.equal(onSceneFloor('outside',600,300),true)
  assert.equal(onSceneFloor('outside',NaN,300),false)
  for(const seat of benchSeats)assert.equal(onSceneFloor('outside',seat.x,seat.y),true)
  assert.equal(isScene('outside'),true);assert.equal(isScene('roof'),false);assert.equal(isScene({toString:()=>'store'}),false)
  assert.equal(isSeat(0),true);assert.equal(isSeat(benchSeats.length),false);assert.equal(isSeat('0'),false);assert.equal(isSeat(.5),false)
  assert.equal(new Set(vendingProducts.map(product=>product.id)).size,vendingProducts.length)
})

test('the neighborhood shares one server with the store, scoped by scene',{timeout:60_000},async t=>{
  const dir=await mkdtemp(join(tmpdir(),'chits-neighborhood-')),sqlite=join(dir,'test.sqlite')
  const reserve=createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening')
  const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve))
  const base=`http://127.0.0.1:${port}`,password=randomBytes(24).toString('hex'),salt=randomBytes(16).toString('hex')
  const env={...process.env,NODE_ENV:'production',NITRO_HOST:'127.0.0.1',NITRO_PORT:String(port),SQLITE_PATH:sqlite,SESSION_SECRET:randomBytes(32).toString('hex'),ADMIN_PASSWORD_HASH:`${salt}:${scryptSync(password,salt,64).toString('hex')}`,PUBLIC_ORIGIN:base}
  const child=spawn(process.execPath,['.output/server/index.mjs'],{cwd:new URL('..',import.meta.url),env,stdio:['ignore','pipe','pipe']})
  let logs='';child.stdout.on('data',d=>{logs+=d});child.stderr.on('data',d=>{logs+=d})
  const peers=[]
  t.after(async()=>{for(const peer of peers)peer.ws.terminate();if(child.exitCode===null){const ended=once(child,'exit');child.kill();await ended}await rm(dir,{recursive:true,force:true});assert.doesNotMatch(logs,/\[uncaughtException\]|\[unhandledRejection\]/)})
  const req=(path,{method='GET',cookie,body}={})=>fetch(base+path,{method,headers:{...(method==='GET'?{}:{Origin:base,'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)})
  for(let i=0;i<100;i++){try{if((await req('/api/store/status')).ok)break}catch{}if(i===99)assert.fail('Server did not start');await delay(40)}
  async function visitor(avatar){const r=await req('/api/visitors/join',{method:'POST',body:{avatar}});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0]}
  async function connect(cookie,query=''){
    const ws=new WebSocket(`${base.replace('http','ws')}/ws${query}`,{headers:{Cookie:cookie,Origin:base}})
    const peer={ws,inbox:[],closed:false,send:data=>ws.send(JSON.stringify(data))};peers.push(peer)
    ws.on('message',d=>peer.inbox.push(JSON.parse(String(d))));ws.on('close',()=>{peer.closed=true});ws.on('error',()=>{})
    await once(ws,'open');peer.id=(await wait(peer,m=>m.type==='welcome')).selfId;return peer
  }
  async function wait(peer,predicate,from=0){
    for(let i=0;i<300;i++){const found=peer.inbox.slice(from).find(predicate);if(found)return found;await delay(10)}
    throw new Error('Expected room event missing')
  }
  const mark=peer=>peer.inbox.length
  const latestPlayers=peer=>peer.inbox.filter(m=>m.type==='players').at(-1)
  const ids=message=>message.players.map(p=>p.id).sort()

  const cookieA=await visitor('mochi'),cookieB=await visitor('boba'),cookieC=await visitor('puto')
  const a=await connect(cookieA),b=await connect(cookieB)
  await t.test('visitors start inside and see each other',async()=>{
    const welcome=a.inbox.find(m=>m.type==='welcome')
    assert.equal(welcome.scene,'store');assert.equal(welcome.players.find(p=>p.id===a.id).x,180)
    await wait(a,m=>m.type==='players'&&m.scene==='store'&&m.players.length===2&&m.online===2)
  })
  await t.test('stepping outside moves the visitor between scene presence lists',async()=>{
    const fromA=mark(a),fromB=mark(b)
    a.send({type:'scene',scene:'outside'})
    const changed=await wait(a,m=>m.type==='scene_changed',fromA)
    assert.equal(changed.scene,'outside');assert.deepEqual([changed.x,changed.y],[360,300])
    assert.deepEqual(changed.players.map(p=>p.id),[a.id]);assert.equal(changed.online,2)
    const inside=await wait(b,m=>m.type==='players'&&m.players.length===1,fromB)
    assert.equal(inside.scene,'store');assert.deepEqual(ids(inside),[b.id]);assert.equal(inside.online,2)
    // The pong count stays store-wide.
    b.send({type:'ping'});assert.equal((await wait(b,m=>m.type==='pong',fromB)).count,2)
  })
  await t.test('moves and emotes only reach the same scene; floors are validated per scene',async()=>{
    const fromA=mark(a),fromB=mark(b)
    a.send({type:'move',x:372,y:310});await delay(90)
    b.send({type:'move',x:190,y:515});await delay(90)
    a.send({type:'emote',emoji:'👋'});b.send({type:'emote',emoji:'❤️'})
    await delay(250)
    assert.equal(b.inbox.slice(fromB).some(m=>m.type==='player_moved'&&m.id===a.id),false)
    assert.equal(b.inbox.slice(fromB).some(m=>m.type==='emote'&&m.id===a.id),false)
    assert.equal(a.inbox.slice(fromA).some(m=>(m.type==='player_moved'||m.type==='emote')&&m.id===b.id),false)
    // Outside the store's walls is fine on the street, but not past the street's own edges.
    const c=await connect(cookieC,'?scene=outside')
    assert.equal(c.inbox.find(m=>m.type==='welcome').scene,'outside')
    const fromC=mark(c)
    a.send({type:'move',x:384,y:318})
    await wait(c,m=>m.type==='player_moved'&&m.id===a.id&&m.x===384,fromC)
    await delay(90);a.send({type:'move',x:384,y:560});await delay(150)
    assert.equal(c.inbox.slice(fromC).some(m=>m.type==='player_moved'&&m.y===560),false)
    await delay(1000);a.send({type:'emote',emoji:'✨'});await wait(c,m=>m.type==='emote'&&m.id===a.id&&m.emoji==='✨',fromC)
    c.ws.terminate();await wait(a,m=>m.type==='players'&&m.players.length===1&&m.online===2,fromA)
  })
  await t.test('chat is shared across scenes and tagged with the speaker’s scene',async()=>{
    const fromA=mark(a),fromB=mark(b)
    // Emotes and chat share one per-visitor pace.
    await delay(1600)
    a.send({type:'chat',text:'Hello from the street'})
    assert.equal((await wait(b,m=>m.type==='chat'&&m.text==='Hello from the street',fromB)).scene,'outside')
    b.send({type:'chat',text:'Hello from inside'})
    assert.equal((await wait(a,m=>m.type==='chat'&&m.text==='Hello from inside',fromA)).scene,'store')
  })
  await t.test('benches seat one visitor each and the pose is shared with late joiners',async()=>{
    const fromA=mark(a)
    a.send({type:'sit',seat:0});assert.deepEqual(await wait(a,m=>m.type==='sit_rejected',fromA),{type:'sit_rejected',seat:0},'too far from the bench')
    for(const [x,y] of [[360,300],[300,300],[240,300],[180,300],[120,300],[100,300]]){a.send({type:'move',x,y});await delay(320)}
    a.send({type:'sit',seat:0})
    assert.deepEqual(await wait(a,m=>m.type==='player_pose',fromA),{type:'player_pose',id:a.id,pose:'sit',seat:0})
    // A late duplicate of the final position does not stand the visitor up.
    a.send({type:'move',x:101,y:300});await delay(100)
    assert.equal(a.inbox.slice(fromA).some(m=>m.type==='player_moved'&&m.x===101),false)
    const c=await connect(cookieC,'?scene=outside')
    const seated=c.inbox.find(m=>m.type==='welcome').players.find(p=>p.id===a.id)
    assert.equal(seated.pose,'sit');assert.equal(seated.seat,0)
    for(const [x,y] of [[350,300],[280,300],[220,300],[160,300],[110,300]]){c.send({type:'move',x,y});await delay(320)}
    const fromC=mark(c)
    c.send({type:'sit',seat:0});await wait(c,m=>m.type==='sit_rejected'&&m.seat===0,fromC)
    c.send({type:'sit',seat:1});await wait(a,m=>m.type==='player_pose'&&m.id===c.id&&m.seat===1)
    for(const seat of [-1,2,'1',null])c.send({type:'sit',seat})
    await wait(c,m=>m.type==='sit_rejected'&&m.seat===undefined,fromC)
    const fromStand=mark(c)
    a.send({type:'stand'})
    assert.deepEqual(await wait(c,m=>m.type==='player_pose'&&m.id===a.id,fromStand),{type:'player_pose',id:a.id,pose:'stand'})
    c.ws.terminate()
  })
  await t.test('coming back inside: spawn by the door, rate limits, and no duplicate avatars',async()=>{
    await delay(850)
    const fromA=mark(a),fromB=mark(b)
    a.send({type:'scene',scene:'store'})
    const back=await wait(a,m=>m.type==='scene_changed',fromA)
    assert.equal(back.scene,'store');assert.deepEqual([back.x,back.y],[180,510]);assert.deepEqual(ids(back),[a.id,b.id].sort())
    await wait(b,m=>m.type==='players'&&m.scene==='store'&&m.players.length===2,fromB)
    // A second door request right away is refused, and the visitor stays inside.
    a.send({type:'scene',scene:'outside'})
    assert.equal((await wait(a,m=>m.type==='scene_rejected',fromA)).scene,'store')
    for(const scene of ['roof',null,{toString:'outside'}])a.send({type:'scene',scene})
    await delay(150)
    assert.equal(a.inbox.slice(fromA).filter(m=>m.type==='scene_changed').length,1)
    // Inside, the bench does not exist.
    a.send({type:'sit',seat:0});await wait(a,m=>m.type==='sit_rejected',fromA)
    // A refresh while outside reconnects there; the old connection is replaced, never duplicated.
    const fresh=await connect(cookieA,'?scene=outside')
    await wait(a,m=>m.type==='replaced',fromA)
    assert.deepEqual(ids(fresh.inbox.find(m=>m.type==='welcome')),[fresh.id])
    const inside=await wait(b,m=>m.type==='players'&&m.players.length===1&&m.online===2,fromB)
    assert.deepEqual(ids(inside),[b.id])
    assert.equal(latestPlayers(b).players.some(p=>p.id===a.id||p.id===fresh.id),false)
    // Disconnecting from the street clears the visitor everywhere.
    fresh.ws.terminate()
    await wait(b,m=>m.type==='players'&&m.online===1,fromB)
  })
  await t.test('staff see which scene each visitor is in',async()=>{
    const login=await req('/api/admin/login',{method:'POST',body:{password}});assert.equal(login.status,200)
    const admin=login.headers.get('set-cookie').split(';')[0]
    const d=await connect(cookieA,'?scene=outside')
    const room=await req('/api/admin/room',{cookie:admin}).then(r=>r.json())
    assert.deepEqual(room.members.map(m=>m.scene).sort(),['outside','store'])
    d.ws.terminate()
  })
})
