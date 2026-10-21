import {test} from 'node:test'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {randomBytes,scryptSync} from 'node:crypto'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createServer} from 'node:http'
import {once} from 'node:events'
import WebSocket from 'ws'

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))
test('resident cat and yarn are shared, bounded, and interaction-owned',{timeout:30_000},async t=>{
  const dir=await mkdtemp(join(tmpdir(),'chits-cat-'))
  const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening')
  const port=server.address().port;await new Promise(resolve=>server.close(resolve))
  const base=`http://127.0.0.1:${port}`,salt=randomBytes(16).toString('hex')
  const child=spawn(process.execPath,['.output/server/index.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,NODE_ENV:'production',NITRO_HOST:'127.0.0.1',NITRO_PORT:String(port),SQLITE_PATH:join(dir,'test.sqlite'),SESSION_SECRET:randomBytes(32).toString('hex'),ADMIN_PASSWORD_HASH:`${salt}:${scryptSync('test-only',salt,64).toString('hex')}`,PUBLIC_ORIGIN:base},stdio:['ignore','pipe','pipe']})
  let logs='';child.stdout.on('data',chunk=>logs+=chunk);child.stderr.on('data',chunk=>logs+=chunk)
  const peers=[]
  t.after(async()=>{for(const peer of peers)peer.ws.terminate();if(child.exitCode===null){const ended=once(child,'exit');child.kill();await ended}await rm(dir,{recursive:true,force:true});assert.doesNotMatch(logs,/uncaughtException|unhandledRejection/)})
  const req=(path,body)=>fetch(base+path,{method:body?'POST':'GET',headers:body?{Origin:base,'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined})
  for(let i=0;i<100;i++){try{if((await req('/api/store/status')).ok)break}catch{}if(i===99)throw new Error('Server did not start');await delay(30)}
  async function connect(avatar){
    const response=await req('/api/visitors/join',{avatar});assert.equal(response.status,200)
    const cookie=response.headers.get('set-cookie').split(';')[0]
    const ws=new WebSocket(base.replace('http','ws')+'/ws',{headers:{Cookie:cookie,Origin:base}})
    const peer={ws,inbox:[]};peers.push(peer);ws.on('message',data=>peer.inbox.push(JSON.parse(String(data))));ws.on('error',()=>{})
    await once(ws,'open');return peer
  }
  async function next(peer,predicate,from=0,timeout=3500){
    const until=Date.now()+timeout
    while(Date.now()<until){const found=peer.inbox.slice(from).find(predicate);if(found)return found;await delay(15)}
    assert.fail('Expected socket event missing')
  }
  const a=await connect('palitaw'),b=await connect('biko')
  const welcomeA=await next(a,m=>m.type==='welcome'),welcomeB=await next(b,m=>m.type==='welcome')
  assert.deepEqual(welcomeA.mascot,welcomeB.mascot)
  assert.equal(welcomeA.mascot.yarn.heldBy,null)
  b.ws.send(JSON.stringify({type:'cat_pet'}))
  await next(b,m=>m.type==='cat_pet_unavailable')
  for(const y of [490,470,450,430,410,390,370,350,330,310,290]){await delay(85);a.ws.send(JSON.stringify({type:'move',x:180,y}))}
  for(const x of [160,140,120,100]){await delay(85);a.ws.send(JSON.stringify({type:'move',x,y:290}))}
  const petFrom=b.inbox.length
  a.ws.send(JSON.stringify({type:'cat_pet'}))
  await next(b,m=>m.type==='mascot'&&m.mascot.cat.purring,petFrom)
  const petCount=b.inbox.filter(m=>m.type==='mascot'&&m.mascot.cat.purring).length
  a.ws.send(JSON.stringify({type:'cat_pet'}))
  await delay(100)
  assert.equal(b.inbox.filter(m=>m.type==='mascot'&&m.mascot.cat.purring).length,petCount)
  a.ws.send(JSON.stringify({type:'yarn_pickup'}))
  const held=await next(b,m=>m.type==='mascot'&&m.mascot.yarn.heldBy===welcomeA.selfId)
  assert.equal(held.mascot.yarn.heldBy,welcomeA.selfId)
  b.ws.send(JSON.stringify({type:'yarn_pickup'}))
  b.ws.send(JSON.stringify({type:'yarn_drag',x:210,y:440}))
  await delay(90)
  assert.equal(b.inbox.some(m=>m.type==='mascot'&&m.mascot.yarn.x===210),false)
  a.ws.send(JSON.stringify({type:'yarn_drag',x:210,y:440}))
  await next(b,m=>m.type==='mascot'&&m.mascot.yarn.x===210)
  a.ws.send(JSON.stringify({type:'yarn_drag',x:500,y:500}))
  await delay(90)
  assert.equal(b.inbox.some(m=>m.type==='mascot'&&m.mascot.yarn.x===500),false)
  a.ws.send(JSON.stringify({type:'yarn_release',x:210,y:440,vx:90,vy:0}))
  await next(b,m=>m.type==='mascot'&&m.mascot.yarn.heldBy===null&&m.mascot.yarn.x>=210)
  b.ws.send(JSON.stringify({type:'yarn_pickup'}))
  await next(a,m=>m.type==='mascot'&&m.mascot.yarn.heldBy===welcomeB.selfId)
  b.ws.close();await once(b.ws,'close')
  // A disconnected owner must not keep a five-second lock.
  const unlockedFrom=a.inbox.length
  a.ws.send(JSON.stringify({type:'yarn_pickup'}))
  await next(a,m=>m.type==='mascot'&&m.mascot.yarn.heldBy===welcomeA.selfId,unlockedFrom)
  a.ws.send(JSON.stringify({type:'yarn_release',x:210,y:440,vx:0,vy:0}))
  await next(a,m=>m.type==='mascot'&&m.mascot.yarn.heldBy===null,unlockedFrom)
  const before=a.inbox.length
  a.ws.send(JSON.stringify({type:'yarn_toss'}))
  await next(a,m=>m.type==='mascot'&&m.mascot.yarn.moving,before)
  const start=Date.now();await delay(1200)
  const positionUpdates=a.inbox.slice(before).filter(m=>m.type==='mascot'&&m.mascot.yarn.moving&&m.mascot.yarn.heldBy===null).length
  assert.ok(positionUpdates<25,`Too many mascot updates: ${positionUpdates}`)
  assert.ok(Date.now()-start>=1100)
})
