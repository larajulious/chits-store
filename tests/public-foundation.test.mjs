import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHmac, randomBytes, scryptSync } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'
import { once } from 'node:events'
import Database from 'better-sqlite3'
import WebSocket from 'ws'

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))
test('public bakery foundation (isolated built server)',{timeout:60_000},async t=>{
  const dir=await mkdtemp(join(tmpdir(),'chits-public-'))
  const sqlite=join(dir,'test.sqlite')
  // Start with the v0.1 schema and a stored order to exercise additive migration.
  let db=new Database(sqlite)
  db.exec(`CREATE TABLE orders(id INTEGER PRIMARY KEY AUTOINCREMENT,order_number TEXT NOT NULL UNIQUE,status TEXT NOT NULL DEFAULT 'Preparing',token_hash TEXT NOT NULL UNIQUE,nickname TEXT,avatar_key TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,served_at INTEGER,revoked_at INTEGER);`)
  db.prepare('INSERT INTO orders(order_number,token_hash,nickname,created_at,updated_at) VALUES(?,?,?,?,?)').run('LEGACY-100','legacy-hash','LegacyNickname',100,100)
  const legacy=db.prepare('SELECT * FROM orders WHERE id=1').get()
  db.close()
  const reserve=createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening')
  const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve))
  const base=`http://127.0.0.1:${port}`,password=randomBytes(24).toString('hex'),secret=randomBytes(32).toString('hex'),salt=randomBytes(16).toString('hex')
  const child=spawn(process.execPath,['.output/server/index.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,NODE_ENV:'production',NITRO_HOST:'127.0.0.1',NITRO_PORT:String(port),SQLITE_PATH:sqlite,SESSION_SECRET:secret,ADMIN_PASSWORD_HASH:`${salt}:${scryptSync(password,salt,64).toString('hex')}`,PUBLIC_ORIGIN:base,TRUST_PROXY:'1'},stdio:['ignore','pipe','pipe']})
  let logs='';child.stdout.on('data',d=>{logs+=d});child.stderr.on('data',d=>{logs+=d})
  const sockets=[]
  t.after(async()=>{
    for(const p of sockets)p.ws.terminate()
    db?.close()
    const exited=once(child,'exit');child.kill();await exited
    await rm(dir,{recursive:true,force:true})
    assert.doesNotMatch(logs,/\[uncaughtException\]|\[unhandledRejection\]/)
  })
  async function req(path,{method='GET',cookie,body,headers={}}={}){
    return fetch(base+path,{method,headers:{...(method==='GET'?{}:{Origin:base,'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)})
  }
  for(let i=0;i<100;i++){
    try{if((await req('/api/admin/session')).ok)break}catch{}
    if(child.exitCode!==null)throw new Error('Test server exited')
    if(i===99)throw new Error('Test server did not start')
    await delay(50)
  }
  const cookieOf=r=>r.headers.get('set-cookie').split(';')[0]
  function signed(id,until){const payload=`visitor.${id}.${until}`;return `chits_visitor=${payload}.${createHmac('sha256',secret).update(payload).digest('hex')}`}
  async function connect(cookie){
    const ws=new WebSocket(base.replace('http','ws')+'/ws',{headers:{Cookie:cookie,Origin:base}})
    const p={ws,inbox:[],closed:false,code:undefined};sockets.push(p)
    ws.on('message',d=>p.inbox.push(JSON.parse(String(d))));ws.on('close',code=>{p.closed=true;p.code=code});ws.on('error',()=>{})
    await once(ws,'open');return p
  }
  async function wait(p,predicate){
    for(let i=0;i<300;i++){const found=p.inbox.find(predicate);if(found)return found;await delay(10)}
    throw new Error('Expected room event missing')
  }
  async function closed(p){for(let i=0;i<300&&!p.closed;i++)await delay(10);assert.equal(p.closed,true)}
  async function deniedSocket(cookie,origin,status){
    const ws=new WebSocket(base.replace('http','ws')+'/ws',{headers:{...(cookie?{Cookie:cookie}:{}),...(origin?{Origin:origin}:{})}})
    ws.on('error',()=>{})
    const code=await new Promise((resolve,reject)=>{
      ws.once('unexpected-response',(_,r)=>{r.resume();ws.terminate();resolve(r.statusCode)})
      ws.once('open',()=>{ws.terminate();reject(new Error('Unauthorized upgrade'))})
    });assert.equal(code,status)
  }
  let admin,one,two,idOne,idTwo,a,b,aid,bid,order
  await t.test('anonymous board is safe, orders stay protected, and old records survive',async()=>{
    const board=await req('/api/orders/board');assert.equal(board.status,200)
    const data=await board.json();assert.deepEqual(Object.keys(data[0]).sort(),['id','number','status'])
    assert.equal(JSON.stringify(data).includes('LegacyNickname'),false)
    assert.equal((await req('/api/me')).status,401)
    assert.equal((await req('/api/admin/orders')).status,401)
    assert.equal((await req('/api/admin/room')).status,401)
    db=new Database(sqlite);assert.deepEqual(db.prepare('SELECT * FROM orders WHERE id=1').get(),legacy)
    assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE name='visitors'").get())
  })
  await t.test('public avatar entry needs no order and returns signed visitor sessions',async()=>{
    for(const [avatar,which] of [['mochi',1],['boba',2]]){
      const r=await req('/api/visitors/join',{method:'POST',body:{avatar}});assert.equal(r.status,200)
      assert.match(r.headers.get('set-cookie'),/HttpOnly.*Secure.*SameSite=Strict/i)
      const profile=await r.json();assert.match(profile.nickname,new RegExp(`^${which===1?'Mochi':'Boba'} #\\d+$`))
      const cookie=cookieOf(r),id=Number(cookie.split('.')[1])
      if(which===1){one=cookie;idOne=id}else{two=cookie;idTwo=id}
    }
    assert.notEqual(idOne,idTwo)
    assert.equal((await req('/api/me',{cookie:one}).then(r=>r.json())).avatar,'mochi')
    assert.equal((await req('/api/admin/orders',{cookie:one})).status,401)
    const again=await req('/api/visitors/join',{method:'POST',cookie:one,body:{avatar:'cupcake'}})
    assert.equal(Number(cookieOf(again).split('.')[1]),idOne)
    await req('/api/visitors/join',{method:'POST',cookie:one,body:{avatar:'mochi'}})
  })
  await t.test('Filipino kakanin selections persist with correct guest names and visitor identity',async()=>{
    const choices=[['palitaw','Palitaw'],['biko','Biko'],['puto','Puto'],['kutsinta','Kutsinta'],['suman','Suman'],['sapin-sapin','Sapin-sapin'],['bibingka','Bibingka'],['pichi-pichi','Pichi-pichi']]
    for(const [avatar,label] of choices){
      const r=await req('/api/visitors/join',{method:'POST',cookie:one,body:{avatar},headers:{'X-Real-IP':'192.0.2.25'}})
      assert.equal(r.status,200)
      assert.equal(Number(cookieOf(r).split('.')[1]),idOne)
      const profile=await r.json();assert.equal(profile.avatar,avatar);assert.equal(profile.nickname,`${label} #${String(idOne).padStart(3,'0')}`)
      assert.equal((await req('/api/me',{cookie:one}).then(res=>res.json())).avatar,avatar)
    }
    await req('/api/visitors/join',{method:'POST',cookie:one,body:{avatar:'mochi'},headers:{'X-Real-IP':'192.0.2.25'}})
  })
  await t.test('invalid avatars, origins, bodies, scopes and expired cookies fail closed',async()=>{
    assert.equal((await req('/api/visitors/join',{method:'POST',body:{avatar:'invalid'}})).status,400)
    assert.equal((await req('/api/visitors/join',{method:'POST',body:null})).status,400)
    assert.equal((await req('/api/visitors/join',{method:'POST',body:{avatar:'mochi'},headers:{Origin:'https://attacker.example'}})).status,403)
    assert.equal((await req('/api/visitors/join',{method:'POST',body:{avatar:'mochi'},headers:{Origin:''}})).status,403)
    assert.equal((await req('/api/visitors/join',{method:'POST',body:{avatar:'x'.repeat(5000)}})).status,413)
    assert.equal((await req('/api/me',{cookie:one+'junk'})).status,401)
    assert.equal((await req('/api/me',{cookie:signed(idOne,Date.now()-1)})).status,401)
    await deniedSocket(undefined,base,401);await deniedSocket(one,'https://attacker.example',403);await deniedSocket(one,undefined,403)
  })
  await t.test('two visitors see presence, movement and two-way chat',async()=>{
    a=await connect(one);aid=(await wait(a,m=>m.type==='welcome')).selfId
    b=await connect(two);bid=(await wait(b,m=>m.type==='welcome')).selfId
    await wait(a,m=>m.type==='players'&&m.players.length===2)
    for(const raw of ['null','[]','42','{'])a.ws.send(raw)
    a.ws.send(JSON.stringify({type:'move',x:{toString:null,valueOf:null},y:500}))
    a.ws.send(JSON.stringify({type:'emote',emoji:{toString:null}}))
    await delay(100)
    a.ws.send(JSON.stringify({type:'move',x:190,y:510}));await wait(b,m=>m.type==='player_moved'&&m.id===aid&&m.x===190)
    b.ws.send(JSON.stringify({type:'move',x:180,y:520}));await wait(a,m=>m.type==='player_moved'&&m.id===bid&&m.y===520)
    a.ws.send(JSON.stringify({type:'chat',text:'Hello Boba'}));await wait(b,m=>m.type==='chat'&&m.text==='Hello Boba')
    b.ws.send(JSON.stringify({type:'chat',text:'Hello Mochi'}));await wait(a,m=>m.type==='chat'&&m.text==='Hello Mochi')
  })
  await t.test('staff create orders without links; Ready and Served update both visitors without ejecting them',async()=>{
    const login=await req('/api/admin/login',{method:'POST',body:{password}});assert.equal(login.status,200);admin=cookieOf(login)
    assert.equal((await req('/api/me',{cookie:admin})).status,401)
    const created=await req('/api/admin/orders',{method:'POST',cookie:admin,body:{number:'PUBLIC-1001'}});assert.equal(created.status,200)
    const result=await created.json();assert.equal('link' in result,false);order=result.order
    assert.equal((await req(`/api/admin/orders/${order.id}`,{method:'PATCH',cookie:admin,body:{status:'Served'}})).status,400)
    for(const status of ['Ready','Served']){
      assert.equal((await req(`/api/admin/orders/${order.id}`,{method:'PATCH',cookie:admin,body:{status}})).status,200)
      await wait(a,m=>m.type==='order_changed'&&m.order.id===order.id&&m.order.status===status)
      await wait(b,m=>m.type==='order_changed'&&m.order.id===order.id&&m.order.status===status)
    }
    assert.equal(a.closed,false);assert.equal(b.closed,false)
    assert.equal(a.inbox.some(m=>m.type==='my_order_changed'),false)
    assert.equal((await req(`/api/admin/orders/${order.id}`,{method:'PATCH',cookie:admin,body:{status:'Ready'}})).status,400)
  })
  await t.test('staff chat switch, mute, unmute and kick work',async()=>{
    async function moderate(body){const r=await req('/api/admin/room',{method:'POST',cookie:admin,body});assert.equal(r.status,200);return r.json()}
    await moderate({action:'toggle_chat',enabled:false});await wait(b,m=>m.type==='chat_enabled'&&!m.enabled)
    b.ws.send(JSON.stringify({type:'chat',text:'blocked globally'}));await wait(b,m=>m.type==='chat_blocked')
    assert.equal(a.inbox.some(m=>m.text==='blocked globally'),false)
    await moderate({action:'toggle_chat',enabled:true})
    await moderate({action:'mute',id:bid});b.ws.send(JSON.stringify({type:'emote',emoji:'👋'}));await delay(100)
    assert.equal(a.inbox.some(m=>m.type==='emote'&&m.id===bid),false)
    await moderate({action:'mute',id:bid})
    await delay(1550);b.ws.send(JSON.stringify({type:'chat',text:'unmuted'}));await wait(a,m=>m.text==='unmuted')
    await moderate({action:'kick',id:bid});await wait(b,m=>m.type==='kicked');await closed(b)
    await wait(a,m=>m.type==='players'&&m.players.length===1)
  })
  await t.test('replacement is explicit and cooldown survives reconnect',async()=>{
    a.ws.send(JSON.stringify({type:'chat',text:'before replacement'}));await wait(a,m=>m.text==='before replacement')
    const next=await connect(one);await wait(next,m=>m.type==='welcome');await wait(a,m=>m.type==='replaced');await closed(a);a=next
    a.ws.send(JSON.stringify({type:'chat',text:'cooldown bypass'}));await delay(100)
    assert.equal(a.inbox.some(m=>m.text==='cooldown bypass'),false)
    assert.equal((await req('/api/admin/room',{cookie:admin}).then(r=>r.json())).members.length,1)
  })
  await t.test('idle visitor session expiry and database revocation close access',async()=>{
    const short=await connect(signed(idTwo,Date.now()+400));await wait(short,m=>m.type==='welcome');await wait(short,m=>m.type==='choose_avatar');await closed(short)
    const fresh=await connect(two);await wait(fresh,m=>m.type==='welcome')
    db.prepare('UPDATE visitors SET revoked_at=? WHERE id=?').run(Date.now(),idTwo)
    await wait(fresh,m=>m.type==='choose_avatar');await closed(fresh)
    assert.equal((await req('/api/me',{cookie:two})).status,401)
    db.prepare('UPDATE visitors SET revoked_at=NULL WHERE id=?').run(idTwo)
  })
  await t.test('oversized frames, message floods and public join rate limits are enforced',async()=>{
    const large=await connect(two);await wait(large,m=>m.type==='welcome');large.ws.send('x'.repeat(5000));await closed(large);assert.equal(large.code,1009)
    const flood=await connect(two);await wait(flood,m=>m.type==='welcome');for(let i=0;i<45;i++)flood.ws.send('{"type":"ping"}');await closed(flood);assert.equal(flood.code,1008)
    for(let i=0;i<15;i++)assert.equal((await req('/api/visitors/join',{method:'POST',cookie:two,body:{avatar:'boba'},headers:{'X-Real-IP':'192.0.2.1'}})).status,200)
    assert.equal((await req('/api/visitors/join',{method:'POST',cookie:two,body:{avatar:'boba'},headers:{'X-Real-IP':'192.0.2.1'}})).status,429)
    assert.equal((await req('/api/visitors/join',{method:'POST',cookie:two,body:{avatar:'boba'},headers:{'X-Real-IP':'192.0.2.2'}})).status,200)
    assert.deepEqual(db.prepare('SELECT * FROM orders WHERE id=1').get(),legacy)
  })
})
