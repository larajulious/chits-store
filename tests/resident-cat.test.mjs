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

const root=new URL('..',import.meta.url)
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))

async function loadMascot(t){
  const dir=await mkdtemp(join(tmpdir(),'chits-local-cat-'))
  t.after(()=>rm(dir,{recursive:true,force:true}))
  const shared=await readFile(new URL('../shared/store-mascot.ts',import.meta.url),'utf8')
  const local=(await readFile(new URL('../game/localMascot.ts',import.meta.url),'utf8')).replace("'../shared/store-mascot'","'./store-mascot.mjs'")
  const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
  await writeFile(join(dir,'store-mascot.mjs'),compile(shared))
  await writeFile(join(dir,'localMascot.mjs'),compile(local))
  return import(pathToFileURL(join(dir,'localMascot.mjs')).href)
}
const allMoods=['walking','sitting','resting','sleeping','stretching','noticing_yarn','approaching_yarn','playing_with_yarn','returning_to_idle','idle','visiting','snuggling']

test('each scene owns its cats and yarn, with local pet and toss state',async t=>{
  const {createLocalMascot}=await loadMascot(t)
  const a=createLocalMascot(),b=createLocalMascot()
  assert.deepEqual(a.snapshot(0),b.snapshot(0))
  assert.deepEqual(a.snapshot(0).cats.map(cat=>cat.name),['Miming','Onay'])
  assert.equal(a.pet({x:232,y:466},0),'petted')
  assert.equal(a.snapshot(0).cats[0].purring,true,'the nearest cat is petted')
  assert.equal(a.snapshot(0).cats[1].purring,false)
  assert.equal(b.snapshot(0).cats[0].purring,false)
  assert.equal(a.pet({x:100,y:300},0,'Onay'),'too_far')
  assert.equal(a.pet({x:250,y:500},0,'Onay'),'petted')
  assert.equal(a.snapshot(0).cats[1].purring,true)
  assert.equal(a.toss(0),true)
  assert.equal(a.toss(100),false)
  assert.equal(b.snapshot(0).yarn.moving,false)
  a.tick(16,16)
  assert.equal(a.snapshot(16).yarn.moving,true)
  assert.equal(b.snapshot(16).yarn.moving,false)
  assert.equal(b.pickup(),true)
  assert.equal(b.drag(210,440,100),true)
  assert.equal(b.drag(500,500,110),false)
  b.release(210,440,90,0,120)
  assert.equal(b.snapshot(120).yarn.x,210)
  assert.equal(a.snapshot(120).yarn.x!==210,true)
  for(let time=32;time<24_000;time+=16)a.tick(time,16)
  for(const cat of a.snapshot(24_000).cats)assert.ok(allMoods.includes(cat.mood),cat.mood)
  assert.equal(b.snapshot(24_000).cats[0].x,232)
})

test('Onay stays by the feedback board; Miming visits and they snuggle side by side',async t=>{
  const {createLocalMascot}=await loadMascot(t)
  const random=Math.random
  t.after(()=>{Math.random=random})
  // 0 makes every roll succeed: Miming sets off to visit Onay as soon as it is next idle.
  Math.random=()=>0
  const mascot=createLocalMascot(),seen={Miming:new Set(),Onay:new Set()}
  const home=mascot.snapshot(0).cats[1]
  assert.deepEqual([home.x,home.y,home.mood],[268,500,'sleeping'])
  let time=0,snuggleSpread=-1
  for(;time<20_000;time+=16){
    if(time===4000)mascot.toss(time)
    mascot.tick(time,16)
    const [miming,onay]=mascot.snapshot(time).cats
    seen.Miming.add(miming.mood);seen.Onay.add(onay.mood)
    assert.deepEqual([onay.x,onay.y],[268,500],'Onay never walks')
    if(miming.mood==='snuggling'&&onay.mood==='snuggling')snuggleSpread=Math.max(snuggleSpread,Math.abs(miming.y-onay.y),Math.abs(Math.abs(miming.x-onay.x)-20))
  }
  assert.ok(seen.Miming.has('visiting'),'Miming walks over')
  assert.ok(seen.Miming.has('snuggling')&&seen.Onay.has('snuggling'),'they sit together')
  assert.equal(snuggleSpread,0,'side by side, 20 px apart')
  assert.deepEqual([...seen.Onay].filter(mood=>!['sleeping','idle','snuggling'].includes(mood)),[],'Onay only sleeps, stands or snuggles')
  for(const moods of Object.values(seen))assert.ok(![...moods].some(mood=>/fight|tumble|chas|flee/.test(mood)),'no fighting or chasing')

  const again=createLocalMascot()
  let t2=0
  for(;t2<20_000&&again.snapshot(t2).cats[0].mood!=='visiting';t2+=16)again.tick(t2,16)
  assert.equal(again.pet({x:250,y:500},t2,'Onay'),'petted')
  again.tick(t2+16,16)
  const [miming,onay]=again.snapshot(t2+16).cats
  assert.equal(onay.purring,true)
  assert.equal(onay.mood,'idle','petting wakes Onay to stand')
  assert.notEqual(miming.mood,'visiting','petting ends the playdate')
})

test('legacy character packets cannot reach other visitors; chat remains shared',{timeout:30_000},async t=>{
  const dir=await mkdtemp(join(tmpdir(),'chits-cat-socket-'))
  const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening')
  const port=server.address().port;await new Promise(resolve=>server.close(resolve))
  const base=`http://127.0.0.1:${port}`,salt=randomBytes(16).toString('hex')
  const child=spawn(process.execPath,['.output/server/index.mjs'],{cwd:root,env:{...process.env,NODE_ENV:'production',NITRO_HOST:'127.0.0.1',NITRO_PORT:String(port),SQLITE_PATH:join(dir,'test.sqlite'),SESSION_SECRET:randomBytes(32).toString('hex'),ADMIN_PASSWORD_HASH:`${salt}:${scryptSync('test-only',salt,64).toString('hex')}`,PUBLIC_ORIGIN:base},stdio:['ignore','pipe','pipe']})
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
  async function next(peer,predicate,from=0){
    for(let i=0;i<200;i++){const found=peer.inbox.slice(from).find(predicate);if(found)return found;await delay(15)}
    assert.fail('Expected socket event missing')
  }
  const a=await connect('palitaw'),b=await connect('biko')
  const welcomeA=await next(a,m=>m.type==='welcome'),welcomeB=await next(b,m=>m.type==='welcome')
  assert.equal(Object.hasOwn(welcomeA,'mascot'),false)
  assert.equal(Object.hasOwn(welcomeB,'mascot'),false)
  const beforeA=a.inbox.length,beforeB=b.inbox.length
  for(const packet of [{type:'cat_pet'},{type:'yarn_pickup'},{type:'yarn_drag',x:210,y:440},{type:'yarn_release',x:210,y:440,vx:90,vy:0},{type:'yarn_toss'}])a.ws.send(JSON.stringify(packet))
  a.ws.send(JSON.stringify({type:'ping'}))
  await next(a,m=>m.type==='pong',beforeA)
  await delay(150)
  assert.ok(a.inbox.slice(beforeA).some(m=>m.type==='pong'))
  assert.ok(a.inbox.slice(beforeA).every(m=>m.type==='pong'||m.type==='players'))
  assert.ok(b.inbox.slice(beforeB).every(m=>m.type==='players'))
  const chatStart=b.inbox.length
  a.ws.send(JSON.stringify({type:'chat',text:'Hello from the store'}))
  const chat=await next(b,m=>m.type==='chat',chatStart)
  assert.equal(chat.text,'Hello from the store')
})
