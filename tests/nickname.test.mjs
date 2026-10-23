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

test('nickname rules: optional, short, plain characters, nothing official or unkind',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'chits-nickname-'))
  t.after(()=>rm(dir,{recursive:true,force:true}))
  await writeFile(join(dir,'nickname.mjs'),compile(await readFile(new URL('../shared/nickname.ts',import.meta.url),'utf8')))
  const {checkNickname}=await import(pathToFileURL(join(dir,'nickname.mjs')).href)
  const ok=value=>{const result=checkNickname(value);assert.equal(result.ok,true,`${value}: ${result.reason}`);return result.nickname}
  const no=value=>assert.equal(checkNickname(value).ok,false,String(value))
  assert.equal(ok('  Lara   J  '),'Lara J');assert.equal(ok('Lara\u0000'),'Lara','invisible characters are dropped');assert.equal(ok(''),'');assert.equal(ok('   '),'')
  for(const name of ['Lara','Ñiño','José_22','Kape-lover','D.J.',"O'Neil",'Juan Dela Cruz','Computation','Mishita','Tangkad'])ok(name)
  for(const name of ['A','x'.repeat(17),'1234','Lara #001','<b>hi</b>','Lara😊','https://x.co',null,42,{}])no(name)
  for(const name of ['Staff','Chits_Staff','admin2','The Barista','Gago','fuck you','tangina mo','Puta'])no(name)
  assert.equal(checkNickname('Gago').reason,'Please choose a kinder name.')
  assert.equal(checkNickname('Admin').reason,'That name is reserved. Try another.')
})

test('visitors choose and change their name; everyone sees it, numbered',{timeout:60_000},async t=>{
  const dir=await mkdtemp(join(tmpdir(),'chits-nickname-server-')),sqlite=join(dir,'test.sqlite')
  const reserve=createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening')
  const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve))
  const base=`http://127.0.0.1:${port}`,password=randomBytes(24).toString('hex'),salt=randomBytes(16).toString('hex')
  const env={...process.env,NODE_ENV:'production',NITRO_HOST:'127.0.0.1',NITRO_PORT:String(port),SQLITE_PATH:sqlite,SESSION_SECRET:randomBytes(32).toString('hex'),ADMIN_PASSWORD_HASH:`${salt}:${scryptSync(password,salt,64).toString('hex')}`,PUBLIC_ORIGIN:base}
  const child=spawn(process.execPath,['.output/server/index.mjs'],{cwd:new URL('..',import.meta.url),env,stdio:['ignore','pipe','pipe']})
  let logs='';child.stdout.on('data',d=>{logs+=d});child.stderr.on('data',d=>{logs+=d})
  const sockets=[]
  t.after(async()=>{for(const ws of sockets)ws.terminate();if(child.exitCode===null){const ended=once(child,'exit');child.kill();await ended}await rm(dir,{recursive:true,force:true});assert.doesNotMatch(logs,/\[uncaughtException\]|\[unhandledRejection\]/)})
  const req=(path,{method='GET',cookie,body,origin=base}={})=>fetch(base+path,{method,headers:{...(method==='GET'?{}:{...(origin?{Origin:origin}:{}),'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)})
  for(let i=0;i<100;i++){try{if((await req('/api/store/status')).ok)break}catch{}if(i===99)assert.fail('Server did not start');await delay(40)}

  // A name at the door is optional; a bad one is refused before any visitor is made.
  assert.equal((await req('/api/visitors/join',{method:'POST',body:{avatar:'puto',nickname:'Gago'}})).status,400)
  const joined=await req('/api/visitors/join',{method:'POST',body:{avatar:'puto',nickname:'  Lara  '}})
  assert.equal(joined.status,200)
  const cookie=joined.headers.get('set-cookie').split(';')[0]
  const named=await joined.json();assert.match(named.nickname,/^Lara #\d{3}$/)
  assert.deepEqual(await req('/api/me',{cookie}).then(r=>r.json()),{nickname:named.nickname,name:'Lara',avatar:'puto',storeOpen:true})
  // Coming back through the door without a name keeps it; a plain visitor gets their buddy's name.
  assert.equal((await req('/api/visitors/join',{method:'POST',cookie,body:{avatar:'boba'}}).then(r=>r.json())).nickname,named.nickname)
  const other=await req('/api/visitors/join',{method:'POST',body:{avatar:'mochi'}})
  const otherCookie=other.headers.get('set-cookie').split(';')[0];assert.match((await other.json()).nickname,/^Mochi #\d{3}$/)

  // Both connect; the other visitor sees the rename in their player list.
  const connect=async cookie=>{const ws=new WebSocket(`${base.replace('http','ws')}/ws`,{headers:{Cookie:cookie,Origin:base}});sockets.push(ws);const inbox=[];ws.on('message',d=>inbox.push(JSON.parse(String(d))));await once(ws,'open');return inbox}
  const mine=await connect(cookie),theirs=await connect(otherCookie)
  for(let i=0;i<100&&!mine.some(m=>m.type==='welcome');i++)await delay(20)
  const selfId=mine.find(m=>m.type==='welcome').selfId,number=named.nickname.slice(-4)

  assert.equal((await req('/api/me/nickname',{method:'POST',body:{nickname:'Kape Lover'}})).status,401)
  assert.equal((await req('/api/me/nickname',{method:'POST',cookie,origin:null,body:{nickname:'Kape Lover'}})).status,403)
  const bad=await req('/api/me/nickname',{method:'POST',cookie,body:{nickname:'Chits Staff'}})
  assert.equal(bad.status,400);assert.equal((await bad.json()).statusMessage,'That name is reserved. Try another.')
  const renamed=await req('/api/me/nickname',{method:'POST',cookie,body:{nickname:'Kape Lover'}})
  assert.deepEqual(await renamed.json(),{nickname:`Kape Lover ${number}`})
  for(let i=0;i<150&&!theirs.some(m=>m.type==='players'&&m.players.some(p=>p.id===selfId&&p.nickname===`Kape Lover ${number}`));i++)await delay(20)
  assert.ok(theirs.some(m=>m.type==='players'&&m.players.some(p=>p.id===selfId&&p.nickname===`Kape Lover ${number}`)),'the rename reaches others')
  // Chat carries the new name.
  sockets[0].send(JSON.stringify({type:'chat',text:'Hello!'}))
  for(let i=0;i<150&&!theirs.some(m=>m.type==='chat');i++)await delay(20)
  assert.equal(theirs.find(m=>m.type==='chat').nickname,`Kape Lover ${number}`)
  // An empty name goes back to the buddy's (Boba since the second visit); renames are limited to a few every ten minutes.
  assert.deepEqual(await req('/api/me/nickname',{method:'POST',cookie,body:{nickname:''}}).then(r=>r.json()),{nickname:`Boba ${number}`})
  assert.equal((await req('/api/me',{cookie}).then(r=>r.json())).name,'')
  const statuses=[]
  for(const name of ['Ana','Ben','Cora','Dan','Eli'])statuses.push((await req('/api/me/nickname',{method:'POST',cookie,body:{nickname:name}})).status)
  assert.deepEqual(statuses,[200,200,200,429,429])
})
