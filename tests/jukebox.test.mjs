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
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
async function load(dir,path,name){
  await writeFile(join(dir,name),compile(await readFile(new URL(path,import.meta.url),'utf8')))
  return import(pathToFileURL(join(dir,name)).href)
}
// Silent MPEG-1 Layer III frames at 32 kbps / 44.1 kHz: 104 bytes and 1152 samples each.
function silentMp3(seconds){
  const frames=Math.round(seconds*44100/1152),frame=Buffer.alloc(104)
  frame.set([0xff,0xfb,0x10,0x00])
  return Buffer.concat(Array.from({length:frames},()=>frame))
}

test('next track: most votes, ties and empty rounds go to the longest-waiting candidate',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'chits-jukebox-rules-'))
  t.after(()=>rm(dir,{recursive:true,force:true}))
  const {chooseNextTrack,votingCandidates}=await load(dir,'../shared/jukebox.ts','jukebox.mjs')
  const order=['a','b','c','d','e','f','g']
  assert.deepEqual(votingCandidates(order,null,{}),['a','b','c','d','e'])
  assert.deepEqual(votingCandidates(order,'a',{a:5}),['b','c','d','e','f'])
  assert.deepEqual(votingCandidates(order,'c',{a:1,b:2,c:3}),['d','e','f','g','a'])
  assert.deepEqual(votingCandidates(['a'],'a',{a:1}),['a'])
  assert.equal(chooseNextTrack(['b','c','d'],[]),'b')
  assert.equal(chooseNextTrack(['b','c','d'],['d','c','d']),'d')
  assert.equal(chooseNextTrack(['b','c','d'],['d','c']),'c')
  assert.equal(chooseNextTrack(['b','c'],['zzz']),'b')
  assert.equal(chooseNextTrack([],['a']),null)
})

test('MP3 duration comes from the file, not the manifest',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'chits-jukebox-mp3-'))
  t.after(()=>rm(dir,{recursive:true,force:true}))
  const {mp3DurationMs}=await load(dir,'../server/utils/mp3.ts','mp3.mjs')
  const synthetic=mp3DurationMs(silentMp3(12))
  assert.ok(Math.abs(synthetic-12000)<50,`synthetic ${synthetic}`)
  const tagged=Buffer.concat([Buffer.from([0x49,0x44,0x33,3,0,0,0,0,0,20]),Buffer.alloc(20,0xff),silentMp3(6)])
  assert.ok(Math.abs(mp3DurationMs(tagged)-6000)<50)
  assert.equal(mp3DurationMs(Buffer.from('not audio at all')),null)
  const shipped=JSON.parse(await readFile(new URL('../music/tracks.json',import.meta.url),'utf8')).tracks
  for(const track of shipped){
    const measured=mp3DurationMs(await readFile(new URL(`../music/${track.file}`,import.meta.url)))
    assert.ok(Math.abs(measured-track.durationSec*1000)<1500,`${track.id}: ${measured}ms`)
  }
})

test('shared timeline, one vote per visitor, late joiners and admin controls',{timeout:60_000},async t=>{
  const dir=await mkdtemp(join(tmpdir(),'chits-jukebox-'))
  const music=join(dir,'music')
  await import('node:fs/promises').then(fs=>fs.mkdir(music))
  for(const name of ['one','two','three','four'])await writeFile(join(music,`${name}.mp3`),silentMp3(30))
  await writeFile(join(music,'tracks.json'),JSON.stringify({tracks:[
    {id:'one',title:'Cozy Afternoon',mood:'Warm',file:'one.mp3',durationSec:30},
    {id:'two',title:'Rainy Cafe',file:'two.mp3',durationSec:30},
    {id:'three',title:'Happy Meryenda',file:'three.mp3',durationSec:30},
    {id:'ghost',title:'Missing',file:'ghost.mp3',durationSec:30},
    {id:'wrong',title:'Wrong length',file:'four.mp3',durationSec:90},
    {id:'twin',title:'Same file',file:'one.mp3',durationSec:30},
  ]}))
  const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening')
  const port=server.address().port;await new Promise(resolve=>server.close(resolve))
  const base=`http://127.0.0.1:${port}`,salt=randomBytes(16).toString('hex')
  const child=spawn(process.execPath,['.output/server/index.mjs'],{cwd:root,env:{...process.env,NODE_ENV:'production',NITRO_HOST:'127.0.0.1',NITRO_PORT:String(port),SQLITE_PATH:join(dir,'test.sqlite'),JUKEBOX_DIR:music,SESSION_SECRET:randomBytes(32).toString('hex'),ADMIN_PASSWORD_HASH:`${salt}:${scryptSync('test-only',salt,64).toString('hex')}`,PUBLIC_ORIGIN:base},stdio:['ignore','pipe','pipe']})
  let logs='';child.stdout.on('data',chunk=>logs+=chunk);child.stderr.on('data',chunk=>logs+=chunk)
  const peers=[]
  t.after(async()=>{for(const peer of peers)peer.ws.terminate();if(child.exitCode===null){const ended=once(child,'exit');child.kill();await ended}await rm(dir,{recursive:true,force:true});assert.doesNotMatch(logs,/uncaughtException|unhandledRejection/)})
  const req=(path,{body,cookie,headers={}}={})=>fetch(base+path,{method:body?'POST':'GET',headers:{...headers,...(body?{Origin:base,'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined})
  for(let i=0;i<100;i++){try{if((await req('/api/store/status')).ok)break}catch{}if(i===99)throw new Error('Server did not start');await delay(30)}
  async function enter(avatar){const response=await req('/api/visitors/join',{body:{avatar}});assert.equal(response.status,200);return response.headers.get('set-cookie').split(';')[0]}
  async function connect(cookie){
    const ws=new WebSocket(base.replace('http','ws')+'/ws',{headers:{Cookie:cookie,Origin:base}})
    const peer={ws,inbox:[]};peers.push(peer);ws.on('message',data=>peer.inbox.push(JSON.parse(String(data))));ws.on('error',()=>{})
    await once(ws,'open');return peer
  }
  async function next(peer,predicate,from=0){
    for(let i=0;i<200;i++){const found=peer.inbox.slice(from).find(predicate);if(found)return found;await delay(15)}
    assert.fail('Expected socket event missing')
  }
  const vote=(peer,trackId,round)=>peer.ws.send(JSON.stringify({type:'jukebox_vote',trackId,round}))

  const cookieA=await enter('palitaw'),cookieB=await enter('biko')
  const a=await connect(cookieA),b=await connect(cookieB)
  const first=(await next(a,m=>m.type==='jukebox')).state,seenByB=(await next(b,m=>m.type==='jukebox')).state
  assert.equal(first.enabled,true)
  assert.equal(first.nowPlaying.track.id,'one')
  assert.equal(seenByB.nowPlaying.startedAt,first.nowPlaying.startedAt)
  assert.deepEqual(first.candidates.map(track=>track.id),['two','three'])
  assert.match(first.nowPlaying.track.src,/^\/jukebox\/audio\/one\.mp3\?v=/)

  // Audio is plain HTTP with byte ranges; only manifest-approved files are reachable.
  const ranged=await req(first.nowPlaying.track.src,{headers:{Range:'bytes=0-9'}})
  assert.equal(ranged.status,206)
  assert.equal(ranged.headers.get('content-range'),`bytes 0-9/${silentMp3(30).length}`)
  assert.equal((await ranged.arrayBuffer()).byteLength,10)
  assert.match(ranged.headers.get('cache-control'),/immutable/)
  assert.equal((await req('/jukebox/audio/ghost.mp3')).status,404)
  assert.equal((await req('/jukebox/audio/..%2F..%2Fpackage.json')).status,404)
  assert.equal((await req('/jukebox/audio/one.mp3',{headers:{Range:'bytes=999999-'}})).status,416)

  const start=b.inbox.length
  vote(a,'three',first.round)
  assert.deepEqual(await next(a,m=>m.type==='jukebox_vote_ok'),{type:'jukebox_vote_ok',round:first.round,trackId:'three'})
  const tally=await next(b,m=>m.type==='jukebox_votes',start)
  assert.deepEqual(tally.votes,{two:0,three:1})
  assert.equal(tally.upNext,'three')

  // A reconnect replaces the old tab and keeps the vote; voting again cannot add a second one.
  const again=await connect(cookieA)
  const rejoined=await next(again,m=>m.type==='jukebox')
  assert.deepEqual(rejoined.myVote,{round:first.round,trackId:'three'})
  assert.equal(rejoined.state.nowPlaying.startedAt,first.nowPlaying.startedAt)
  await delay(450)
  vote(again,'three',first.round)
  await next(again,m=>m.type==='jukebox_vote_ok')
  await delay(450)
  vote(again,'two',first.round)
  await next(again,m=>m.type==='jukebox_vote_ok'&&m.trackId==='two')
  const before=b.inbox.length
  vote(b,'three',first.round)
  await next(b,m=>m.type==='jukebox_vote_ok')
  const tie=await next(b,m=>m.type==='jukebox_votes'&&m.votes.three===1,before)
  assert.deepEqual(tie.votes,{two:1,three:1})
  assert.equal(tie.upNext,'two','ties go to the longest-waiting candidate')

  vote(b,'nope',first.round)
  assert.equal((await next(b,m=>m.type==='jukebox_vote_rejected')).reason,'not_candidate')

  const late=await connect(await enter('mochi'))
  const lateState=await next(late,m=>m.type==='jukebox')
  assert.equal(lateState.state.nowPlaying.startedAt,first.nowPlaying.startedAt)
  assert.equal(lateState.myVote,null)

  // Admin: library validation, skip to the winner, and switching the jukebox off.
  assert.equal((await req('/api/admin/jukebox')).status,401)
  const login=await req('/api/admin/login',{body:{password:'test-only'}})
  assert.equal(login.status,200)
  const admin=login.headers.get('set-cookie').split(';')[0]
  const view=await (await req('/api/admin/jukebox',{cookie:admin})).json()
  assert.equal(view.totalVotes,2)
  assert.match(view.library.find(track=>track.id==='ghost').reason,/Missing file/)
  assert.match(view.library.find(track=>track.id==='wrong').reason,/plays for 30\.0s/)
  assert.match(view.library.find(track=>track.id==='twin').reason,/already uses this file/)
  assert.equal((await req('/api/admin/jukebox',{body:{action:'skip'}})).status,401)
  const lateStart=late.inbox.length
  const skipped=await req('/api/admin/jukebox',{cookie:admin,body:{action:'skip'}})
  assert.equal(skipped.status,200)
  const afterSkip=(await next(late,m=>m.type==='jukebox'&&m.state.round!==first.round,lateStart)).state
  assert.equal(afterSkip.nowPlaying.track.id,'two')
  assert.deepEqual(afterSkip.votes,{one:0,three:0})
  vote(b,'three',first.round)
  assert.equal((await next(b,m=>m.type==='jukebox_vote_rejected'&&m.reason==='round_closed')).round,afterSkip.round)

  const offStart=b.inbox.length
  assert.equal((await req('/api/admin/jukebox',{cookie:admin,body:{action:'settings',enabled:false}})).status,200)
  const off=(await next(b,m=>m.type==='jukebox'&&!m.state.enabled,offStart)).state
  assert.equal(off.nowPlaying,null)
  await delay(450)
  vote(b,'three')
  assert.equal((await next(b,m=>m.type==='jukebox_vote_rejected'&&m.reason==='disabled',offStart)).reason,'disabled')
  assert.equal((await req('/api/admin/jukebox',{cookie:admin,body:{action:'settings',trackIds:['ghost']}})).status,400)

  // New songs dropped into the folder appear without a restart or a manual rescan.
  const manifest=JSON.parse(await readFile(join(music,'tracks.json'),'utf8'))
  await writeFile(join(music,'five.mp3'),silentMp3(20))
  manifest.tracks.push({id:'five',title:'Pixel Chill',file:'five.mp3',durationSec:20})
  await writeFile(join(music,'tracks.json'),JSON.stringify(manifest))
  let added
  for(let i=0;i<30&&!added?.available;i++){
    await delay(500)
    added=(await (await req('/api/admin/jukebox',{cookie:admin})).json()).library.find(track=>track.id==='five')
  }
  assert.equal(added?.available,true)
  assert.equal(added.selected,true)
})
