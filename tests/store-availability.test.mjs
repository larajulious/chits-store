import {test} from 'node:test'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {randomBytes,scryptSync} from 'node:crypto'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createServer} from 'node:http'
import {once} from 'node:events'
import Database from 'better-sqlite3'
import WebSocket from 'ws'

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))
test('staff store availability persists; a closed store keeps visitors on the street',{timeout:30_000},async t=>{
  const dir=await mkdtemp(join(tmpdir(),'chits-store-availability-')),sqlite=join(dir,'test.sqlite')
  const db=new Database(sqlite)
  db.exec("CREATE TABLE orders(id INTEGER PRIMARY KEY AUTOINCREMENT,order_number TEXT NOT NULL UNIQUE,status TEXT NOT NULL DEFAULT 'Preparing' CHECK(status IN ('Preparing','Ready','Served')),token_hash TEXT NOT NULL UNIQUE,nickname TEXT,avatar_key TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,served_at INTEGER,revoked_at INTEGER)")
  db.prepare('INSERT INTO orders(order_number,token_hash,created_at,updated_at) VALUES(?,?,?,?)').run('LEGACY-100','legacy-hash',100,100)
  const reserve=createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening')
  const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve))
  const base=`http://127.0.0.1:${port}`,password=randomBytes(24).toString('hex'),salt=randomBytes(16).toString('hex')
  const env={...process.env,NODE_ENV:'production',NITRO_HOST:'127.0.0.1',NITRO_PORT:String(port),SQLITE_PATH:sqlite,SESSION_SECRET:randomBytes(32).toString('hex'),ADMIN_PASSWORD_HASH:`${salt}:${scryptSync(password,salt,64).toString('hex')}`,PUBLIC_ORIGIN:base}
  let child,logs='',admin,one,two
  const sockets=[]
  const cookieOf=response=>response.headers.get('set-cookie').split(';')[0]
  async function req(path,{method='GET',cookie,body,headers={}}={}){
    return fetch(base+path,{method,headers:{...(method==='GET'?{}:{Origin:base,'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)})
  }
  async function start(){
    child=spawn(process.execPath,['.output/server/index.mjs'],{cwd:new URL('..',import.meta.url),env,stdio:['ignore','pipe','pipe']})
    child.stdout.on('data',data=>logs+=data);child.stderr.on('data',data=>logs+=data)
    for(let i=0;i<100;i++){
      try{if((await req('/api/admin/session')).ok)return}catch{}
      if(child.exitCode!==null)throw new Error('Store availability test server exited')
      await delay(30)
    }
    throw new Error('Store availability test server did not start')
  }
  async function stop(){if(child&&child.exitCode===null){const ended=once(child,'exit');child.kill();await ended}}
  async function connect(cookie,query=''){
    const ws=new WebSocket(base.replace('http','ws')+'/ws'+query,{headers:{Cookie:cookie,Origin:base}})
    const record={ws,inbox:[],closed:false};sockets.push(record)
    ws.on('message',data=>record.inbox.push(JSON.parse(String(data))))
    ws.on('close',()=>record.closed=true);ws.on('error',()=>{})
    await once(ws,'open');return record
  }
  async function waitFor(predicate){
    for(let i=0;i<300;i++){if(predicate())return;await delay(10)}
    assert.fail('Expected store availability event missing')
  }
  const sent=(record,data)=>record.ws.send(JSON.stringify(data))
  const change=(open,options={})=>req('/api/admin/store/status',{method:'POST',cookie:admin,body:{open},...options})
  t.after(async()=>{for(const socket of sockets)socket.ws.terminate();await stop();db.close();await rm(dir,{recursive:true,force:true});assert.doesNotMatch(logs,/\[uncaughtException\]|\[unhandledRejection\]/)})
  await start()

  await t.test('legacy installations start open and only staff can change availability',async()=>{
    const status=await req('/api/store/status');assert.equal(status.status,200);assert.deepEqual(await status.json(),{open:true});assert.match(status.headers.get('cache-control'),/no-store/)
    assert.equal((await change(false,{cookie:undefined})).status,401)
    const login=await req('/api/admin/login',{method:'POST',body:{password}});assert.equal(login.status,200);admin=cookieOf(login)
    const guest=await req('/api/visitors/join',{method:'POST',body:{avatar:'palitaw'}});assert.equal(guest.status,200);one=cookieOf(guest)
    const other=await req('/api/visitors/join',{method:'POST',body:{avatar:'biko'}});assert.equal(other.status,200);two=cookieOf(other)
    assert.equal((await change(false,{cookie:one})).status,401)
    assert.equal((await change(false,{headers:{Origin:'https://attacker.example'}})).status,403)
    for(const body of [{}, {open:'false'}, {open:null}, null, []])assert.equal((await change(false,{body})).status,400)
    assert.equal((await change(false,{body:{open:'x'.repeat(5000)}})).status,413)
    assert.equal((await req('/api/store/status').then(response=>response.json())).open,true)
  })
  await t.test('closing walks visitors out to the street without disconnecting anyone',async()=>{
    const first=await connect(one),second=await connect(two)
    await waitFor(()=>first.inbox.some(message=>message.type==='players'&&message.players.length===2))
    sent(first,{type:'scene',scene:'outside'})
    await waitFor(()=>first.inbox.some(message=>message.type==='scene_changed'&&message.scene==='outside'))
    const closed=await change(false);assert.equal(closed.status,200);assert.deepEqual(await closed.json(),{open:false})
    await waitFor(()=>second.inbox.some(message=>message.type==='scene_changed'&&message.scene==='outside'))
    await waitFor(()=>[first,second].every(socket=>socket.inbox.some(message=>message.type==='store_status'&&message.open===false)))
    await waitFor(()=>first.inbox.some(message=>message.type==='players'&&message.scene==='outside'&&message.players.length===2))
    assert.equal(first.closed,false);assert.equal(second.closed,false)
    assert.equal([first,second].some(socket=>socket.inbox.some(message=>message.type==='store_closed')),false)
    assert.deepEqual(await req('/api/store/status').then(response=>response.json()),{open:false})
    // The door stays locked until staff reopen.
    sent(second,{type:'scene',scene:'store'})
    await waitFor(()=>second.inbox.some(message=>message.type==='scene_rejected'&&message.reason==='closed'))
    assert.equal(second.inbox.filter(message=>message.type==='scene_changed').at(-1).scene,'outside')
  })
  await t.test('a closed store still lets visitors in, onto the street; ordering pauses',async()=>{
    const fresh=await req('/api/visitors/join',{method:'POST',body:{avatar:'mochi'}});assert.equal(fresh.status,200)
    assert.equal((await req('/api/visitors/join',{method:'POST',cookie:one,body:{avatar:'mochi'}})).status,200)
    const profile=await req('/api/me',{cookie:one});assert.equal(profile.status,200);assert.equal((await profile.json()).storeOpen,false)
    // Even a page that asks for the store lands outside.
    const visitor=await connect(cookieOf(fresh),'?scene=store')
    await waitFor(()=>visitor.inbox.some(message=>message.type==='welcome'))
    const welcome=visitor.inbox.find(message=>message.type==='welcome')
    assert.equal(welcome.scene,'outside');assert.equal(welcome.storeOpen,false);assert.equal(welcome.players.length,3)
    assert.equal((await req('/api/orders',{method:'POST',cookie:one,body:{items:[{id:1,quantity:1}]}})).status,503)
    assert.equal((await req('/api/orders/mine',{cookie:one})).status,200)
    assert.equal((await req('/api/feedback',{method:'POST',cookie:one,body:{kind:'suggestion',text:'While closed'}})).status,503)
    // Staff can still answer the community chat on the street.
    assert.equal((await req('/api/admin/chat',{method:'POST',cookie:admin,body:{text:'We open again tomorrow!'}})).status,200)
    await waitFor(()=>visitor.inbox.some(message=>message.type==='chat'&&message.text==='We open again tomorrow!'))
    assert.equal(db.prepare('SELECT COUNT(*) AS total FROM visitors').get().total,3)
    assert.equal(db.prepare("SELECT order_number FROM orders WHERE id=1").get().order_number,'LEGACY-100')
  })
  await t.test('closed state survives restart; reopening unlocks the door',async()=>{
    for(const socket of sockets)socket.ws.terminate()
    await stop();await start()
    assert.deepEqual(await req('/api/store/status').then(response=>response.json()),{open:false})
    const guest=await req('/api/visitors/join',{method:'POST',body:{avatar:'mochi'}});assert.equal(guest.status,200)
    const visitor=await connect(cookieOf(guest));await waitFor(()=>visitor.inbox.some(message=>message.type==='welcome'))
    assert.equal(visitor.inbox.find(message=>message.type==='welcome').scene,'outside')
    const opened=await change(true);assert.equal(opened.status,200);assert.deepEqual(await opened.json(),{open:true})
    await waitFor(()=>visitor.inbox.some(message=>message.type==='store_status'&&message.open===true))
    assert.equal((await req('/api/me',{cookie:one}).then(response=>response.json())).storeOpen,true)
    sent(visitor,{type:'scene',scene:'store'})
    await waitFor(()=>visitor.inbox.some(message=>message.type==='scene_changed'&&message.scene==='store'))
    assert.equal((await req('/api/feedback',{method:'POST',cookie:one,body:{kind:'suggestion',text:'Open again'}})).status,200)
    assert.equal((await req('/api/admin/chat',{method:'POST',cookie:admin,body:{text:'Welcome back'}})).status,200)
    const before=visitor.inbox.length
    assert.equal((await change(false)).status,200)
    await waitFor(()=>visitor.inbox.slice(before).some(message=>message.type==='scene_changed'&&message.scene==='outside'))
    assert.equal(visitor.closed,false)
    assert.deepEqual(db.prepare('SELECT is_open FROM store_settings WHERE id=1').get(),{is_open:0})
  })
})
