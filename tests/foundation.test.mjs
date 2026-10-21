import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { createHmac, randomBytes, scryptSync, createHash } from 'node:crypto'
import { mkdtemp, rm, access, readFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer, request as httpRequest } from 'node:http'
import { once } from 'node:events'
import Database from 'better-sqlite3'
import WebSocket from 'ws'

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

// Historical v0.1 invitation tests. Public entry intentionally removes this contract.
// npm test runs public-foundation.test.mjs for the current visitor-based model.
test.skip('v0.1 invitation model (superseded by public visitor tests)', { timeout: 60_000 }, async t => {
  await access(new URL('../.output/server/index.mjs', import.meta.url))
  const dir = await mkdtemp(join(tmpdir(), 'chits-foundation-'))
  const reserve = createServer()
  reserve.listen(0, '127.0.0.1')
  await once(reserve, 'listening')
  const port = reserve.address().port
  await new Promise(resolve => reserve.close(resolve))
  const base = `http://127.0.0.1:${port}`
  const password = randomBytes(24).toString('base64url')
  const secret = randomBytes(32).toString('hex')
  const salt = randomBytes(16).toString('hex')
  const sqlitePath = join(dir, 'test.sqlite')
  const child = spawn(process.execPath, ['.output/server/index.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, NODE_ENV:'production', NITRO_HOST:'127.0.0.1', NITRO_PORT:String(port),
      SQLITE_PATH:sqlitePath, SESSION_SECRET:secret, PUBLIC_ORIGIN:base, TRUST_PROXY:'1',
      ADMIN_PASSWORD_HASH:`${salt}:${scryptSync(password,salt,64).toString('hex')}` },
    stdio: ['ignore','pipe','pipe'],
  })
  let output = ''
  child.stdout.on('data', data => { output += data })
  child.stderr.on('data', data => { output += data })
  const sockets = []
  let db
  t.after(async () => {
    for (const { ws } of sockets) ws.terminate()
    db?.close()
    const exited = once(child, 'exit')
    child.kill('SIGTERM')
    await exited
    await rm(dir, { recursive:true, force:true })
    assert.doesNotMatch(output, /\[uncaughtException\]|\[unhandledRejection\]/)
  })
  async function req(path, { method='GET', body, cookie, origin=base, headers={} } = {}) {
    return fetch(base+path, { method, headers:{ ...(method==='GET'?{}:{Origin:origin, 'Content-Type':'application/json'}),
      ...(cookie?{Cookie:cookie}:{}), ...headers }, body:body===undefined?undefined:JSON.stringify(body) })
  }
  for (let i=0;i<100;i++) {
    try { if ((await req('/api/admin/session')).ok) break } catch {}
    if (child.exitCode !== null) throw new Error(`Server exited: ${output}`)
    if (i===99) throw new Error('Server failed to start')
    await delay(50)
  }
  let admin, one, two, guestOne, guestTwo
  const cookieOf = res => res.headers.get('set-cookie').split(';')[0]
  const signed = (scope,id,expires) => {
    const payload=`${scope}.${id}.${expires}`
    return `chits_${scope==='guest'?'guest':'admin'}=${payload}.${createHmac('sha256',secret).update(payload).digest('hex')}`
  }
  async function connect(cookie, origin=base) {
    const ws = new WebSocket(base.replace('http','ws')+'/ws', { headers:{ ...(cookie?{Cookie:cookie}:{}), ...(origin?{Origin:origin}:{}) } })
    const inbox = []
    const client = { ws, inbox, closed:false, code:undefined }
    sockets.push(client)
    ws.on('message', data => { inbox.push(JSON.parse(String(data))) })
    ws.on('close', code => { client.closed=true;client.code=code })
    ws.on('error', () => {})
    await once(ws,'open')
    return client
  }
  async function wait(client, predicate, timeout=3000) {
    const until=Date.now()+timeout
    while(Date.now()<until) {
      const found=client.inbox.find(predicate)
      if(found)return found
      await delay(10)
    }
    throw new Error('Expected WebSocket event not received')
  }
  async function closed(client) {
    for(let i=0;i<300&&!client.closed;i++)await delay(10)
    assert.equal(client.closed,true)
  }
  async function rejectedSocket(cookie,origin,status) {
    const ws=new WebSocket(base.replace('http','ws')+'/ws',{headers:{...(cookie?{Cookie:cookie}:{}),...(origin?{Origin:origin}:{})}})
    const response=await new Promise((resolve,reject)=>{
      ws.once('unexpected-response',(_,res)=>{res.resume();ws.terminate();resolve(res.statusCode)})
      ws.once('open',()=>{ws.terminate();reject(new Error('Unauthorized WebSocket upgraded'))})
      ws.on('error',()=>{})
    })
    assert.equal(response,status)
  }

  await t.test('admin authentication, cookie flags, authorization and cache headers', async () => {
    assert.equal((await req('/api/admin/orders')).status,401)
    assert.equal((await req('/api/admin/orders',{method:'POST',body:{number:'UNAUTH'}})).status,401)
    assert.equal((await req('/api/admin/login',{method:'POST',body:{password:'wrong'}})).status,401)
    const login=await req('/api/admin/login',{method:'POST',body:{password}})
    assert.equal(login.status,200)
    assert.match(login.headers.get('set-cookie'),/HttpOnly/i)
    assert.match(login.headers.get('set-cookie'),/Secure/)
    assert.match(login.headers.get('set-cookie'),/SameSite=Strict/i)
    assert.equal(login.headers.get('cache-control'),'no-store')
    admin=cookieOf(login)
    assert.equal((await req('/api/admin/session',{cookie:admin}).then(r=>r.json())).authenticated,true)
    assert.equal((await req('/api/admin/orders',{cookie:admin+'zz'})).status,401)
    assert.equal((await req('/api/admin/orders',{cookie:signed('admin',1,Date.now()-1)})).status,401)
    assert.equal((await req('/admin')).headers.get('x-frame-options'),'DENY')
  })
  await t.test('HTTP origins, malformed JSON, form bodies and streamed body limits', async () => {
    for(const origin of ['https://attacker.example','null','invalid',base.replace('http:','https:')]) {
      assert.equal((await req('/api/admin/orders',{method:'POST',cookie:admin,body:{number:'BAD'},origin})).status,403)
    }
    assert.equal((await req('/api/admin/login',{method:'POST',body:{password},headers:{Origin:''}})).status,403)
    for(const body of [null,[],42]) assert.equal((await req('/api/access',{method:'POST',body})).status,400)
    assert.equal((await fetch(base+'/api/access',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:'{'})).status,400)
    assert.equal((await fetch(base+'/api/access',{method:'POST',headers:{Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:'token=foo'})).status,415)
    assert.equal((await req('/api/access',{method:'POST',body:{token:'x'.repeat(5000)}})).status,413)
    const status=await new Promise((resolve,reject)=>{
      const r=httpRequest(base+'/api/access',{method:'POST',headers:{Origin:base,'Content-Type':'application/json','Transfer-Encoding':'chunked'}},res=>{res.resume();resolve(res.statusCode)})
      r.on('error',reject);r.write('{"token":"');r.write('x'.repeat(5000));r.end('"}')
    })
    assert.equal(status,413)
  })
  await t.test('create unique orders, hash bearer links and preserve private fields', async () => {
    assert.equal((await req('/api/admin/orders',{method:'POST',cookie:admin,body:{number:'!'}})).status,400)
    for(const number of ['TEST-1001','TEST-1002']) {
      const r=await req('/api/admin/orders',{method:'POST',cookie:admin,body:{number}})
      assert.equal(r.status,200)
      const data=await r.json()
      assert.match(data.link,/^\/enter\/[A-Za-z0-9_-]{43}$/)
      assert.equal(data.order.status,'Preparing')
      if(!one)one=data;else two=data
    }
    assert.notEqual(one.link,two.link)
    assert.equal((await req('/api/admin/orders',{method:'POST',cookie:admin,body:{number:'test-1001'}})).status,409)
    db=new Database(sqlitePath)
    const stored=db.prepare('SELECT * FROM orders WHERE id=?').get(one.order.id)
    assert.equal(stored.token_hash,createHash('sha256').update(one.link.split('/').at(-1)).digest('hex'))
    const list=await req('/api/admin/orders',{cookie:admin}).then(r=>r.json())
    assert.equal(JSON.stringify(list).includes(stored.token_hash),false)
  })
  await t.test('invitations, profile validation, session scope, tampering and expiry', async () => {
    assert.equal((await req('/api/me')).status,401)
    assert.equal((await req('/api/orders/board')).status,401)
    assert.equal((await req('/api/access',{method:'POST',body:{token:'x'.repeat(43)}})).status,403)
    assert.equal((await req('/api/access',{method:'POST',body:{token:{toString:null}}})).status,403)
    for(const data of [one,two]) {
      const r=await req('/api/access',{method:'POST',body:{token:data.link.split('/').at(-1)}})
      assert.equal(r.status,200)
      assert.match(r.headers.get('set-cookie'),/HttpOnly.*Secure.*SameSite=Strict/i)
      const cookie=cookieOf(r)
      await rejectedSocket(cookie,base,401)
      assert.equal((await req('/api/me/profile',{method:'POST',cookie,body:{nickname:'<script>',avatar:'mochi'}})).status,400)
      assert.equal((await req('/api/me/profile',{method:'POST',cookie,body:{nickname:'ValidName',avatar:'invalid'}})).status,400)
      assert.equal((await req('/api/me/profile',{method:'POST',cookie,body:{nickname:data===one?'MochiTest':'BobaTest',avatar:data===one?'mochi':'boba'}})).status,200)
      if(data===one)guestOne=cookie;else guestTwo=cookie
    }
    assert.equal((await req('/api/admin/orders',{cookie:guestOne})).status,401)
    assert.equal((await req('/api/me',{cookie:admin})).status,401)
    assert.equal((await req('/api/me',{cookie:guestOne+'junk'})).status,401)
    assert.equal((await req('/api/me',{cookie:'chits_guest=%ZZ'})).status,401)
    assert.equal((await req('/api/me',{cookie:signed('guest',one.order.id,Date.now()-1)})).status,401)
    assert.equal((await req('/api/me',{cookie:guestOne.replace(`guest.${one.order.id}.`,`guest.${two.order.id}.`)})).status,401)
    const mine=await req('/api/me',{cookie:guestOne}).then(r=>r.json())
    assert.equal(mine.order.id,one.order.id)
    const board=await req('/api/orders/board',{cookie:guestOne}).then(r=>r.json())
    assert.equal(board.length,2)
    assert.deepEqual(Object.keys(board[0]).sort(),['id','number','status'])
  })
  await t.test('WebSocket handshake rejects missing, invalid and cross-origin sessions', async () => {
    await rejectedSocket(undefined,base,401)
    await rejectedSocket(guestOne,'https://attacker.example',403)
    await rejectedSocket(guestOne,undefined,403)
    await rejectedSocket(signed('guest',one.order.id,Date.now()-1),base,401)
  })
  let a,b,aid,bid
  await t.test('two-customer presence, movement bounds, malformed messages and bidirectional chat', async () => {
    a=await connect(guestOne);aid=(await wait(a,m=>m.type==='welcome')).selfId
    b=await connect(guestTwo);bid=(await wait(b,m=>m.type==='welcome')).selfId
    const presence=await wait(a,m=>m.type==='players'&&m.players.length===2)
    assert.deepEqual(presence.players.map(p=>p.nickname).sort(),['BobaTest','MochiTest'])
    for(const raw of ['null','[]','42','{','"chat"'])a.ws.send(raw)
    a.ws.send(JSON.stringify({type:'move',x:{valueOf:null,toString:null},y:510}))
    a.ws.send(JSON.stringify({type:'emote',emoji:{toString:null}}))
    a.ws.send(JSON.stringify({type:'move',x:999,y:510}))
    await delay(100)
    a.ws.send(JSON.stringify({type:'move',x:190,y:510}))
    assert.equal((await wait(b,m=>m.type==='player_moved'&&m.id===aid)).x,190)
    assert.equal(b.inbox.some(m=>m.type==='player_moved'&&m.x===999),false)
    b.ws.send(JSON.stringify({type:'move',x:180,y:520}))
    assert.equal((await wait(a,m=>m.type==='player_moved'&&m.id===bid)).y,520)
    a.ws.send(JSON.stringify({type:'chat',text:'Hello Boba'}))
    assert.equal((await wait(b,m=>m.type==='chat'&&m.id===aid)).text,'Hello Boba')
    b.ws.send(JSON.stringify({type:'chat',text:'Hello Mochi'}))
    assert.equal((await wait(a,m=>m.type==='chat'&&m.id===bid)).text,'Hello Mochi')
    a.ws.send(JSON.stringify({type:'chat',text:'rate-limited'}))
    await delay(100)
    assert.equal(b.inbox.some(m=>m.text==='rate-limited'),false)
  })
  await t.test('Ready/Served notifications stay personal; transitions are forward-only and idempotent', async () => {
    const path=`/api/admin/orders/${one.order.id}`
    assert.equal((await req(path,{method:'PATCH',cookie:guestOne,body:{status:'Ready'}})).status,401)
    assert.equal((await req(path,{method:'PATCH',cookie:admin,body:{status:'Served'}})).status,400)
    assert.equal((await req(path,{method:'PATCH',cookie:admin,body:{status:'Ready'}})).status,200)
    assert.equal((await wait(a,m=>m.type==='my_order_changed'&&m.status==='Ready')).number,'TEST-1001')
    await wait(b,m=>m.type==='order_changed'&&m.order.id===one.order.id&&m.order.status==='Ready')
    assert.equal(b.inbox.some(m=>m.type==='my_order_changed'),false)
    assert.equal((await req('/api/me',{cookie:guestTwo}).then(r=>r.json())).order.status,'Preparing')
    assert.equal((await req(path,{method:'PATCH',cookie:admin,body:{status:'Preparing'}})).status,400)
    assert.equal((await req(path,{method:'PATCH',cookie:admin,body:{status:'Served'}})).status,200)
    await wait(a,m=>m.type==='my_order_changed'&&m.status==='Served')
    const servedAt=db.prepare('SELECT served_at FROM orders WHERE id=?').get(one.order.id).served_at
    assert.equal((await req(path,{method:'PATCH',cookie:admin,body:{status:'Served'}})).status,200)
    assert.equal(db.prepare('SELECT served_at FROM orders WHERE id=?').get(one.order.id).served_at,servedAt)
    assert.equal((await req(path,{method:'PATCH',cookie:admin,body:{status:'Ready'}})).status,400)
    assert.equal((await req('/api/me',{cookie:guestOne})).status,200)
    assert.equal((await req('/api/admin/orders/nope',{method:'PATCH',cookie:admin,body:{status:'Ready'}})).status,400)
    assert.equal((await req('/api/admin/orders/99999',{method:'PATCH',cookie:admin,body:{status:'Ready'}})).status,404)
  })
  await t.test('replacement is explicit; reconnect welcome reconciles current order status', async () => {
    const replacement=await connect(guestOne)
    const welcome=await wait(replacement,m=>m.type==='welcome')
    assert.equal(welcome.order.status,'Served')
    await wait(a,m=>m.type==='replaced')
    await closed(a)
    a=replacement
    assert.equal(welcome.players.length,2)
  })
  await t.test('Served grace boundary expires idle socket, API, invitation and board', async () => {
    db.prepare('UPDATE orders SET served_at=? WHERE id=?').run(Date.now()-5*60_000+300,one.order.id)
    await wait(a,m=>m.type==='expired')
    await closed(a)
    assert.equal((await req('/api/me',{cookie:guestOne})).status,401)
    assert.equal((await req('/api/access',{method:'POST',body:{token:one.link.split('/').at(-1)}})).status,403)
    const board=await req('/api/orders/board',{cookie:guestTwo}).then(r=>r.json())
    assert.equal(board.some(o=>o.id===one.order.id),false)
    await wait(b,m=>m.type==='players'&&m.players.length===1)
  })
  await t.test('signed session expiry and database revocation close idle sockets', async () => {
    const short=await connect(signed('guest',two.order.id,Date.now()+400))
    await wait(short,m=>m.type==='welcome')
    await wait(short,m=>m.type==='expired')
    await closed(short)
    const fresh=await connect(guestTwo)
    await wait(fresh,m=>m.type==='welcome')
    db.prepare('UPDATE orders SET revoked_at=? WHERE id=?').run(Date.now(),two.order.id)
    await wait(fresh,m=>m.type==='expired')
    await closed(fresh)
    assert.equal((await req('/api/me',{cookie:guestTwo})).status,401)
    assert.equal((await req('/api/access',{method:'POST',body:{token:two.link.split('/').at(-1)}})).status,403)
    await rejectedSocket(guestTwo,base,401)
    db.prepare('UPDATE orders SET revoked_at=NULL WHERE id=?').run(two.order.id)
  })
  await t.test('oversized WebSocket frames and message floods close abusive connections', async () => {
    const large=await connect(guestTwo)
    await wait(large,m=>m.type==='welcome')
    large.ws.send('x'.repeat(5000))
    await closed(large)
    assert.equal(large.code,1009)
    const flood=await connect(guestTwo)
    await wait(flood,m=>m.type==='welcome')
    for(let i=0;i<45;i++)flood.ws.send('{"type":"ping"}')
    await closed(flood)
    assert.equal(flood.code,1008)
  })
  await t.test('admin logout clears browser cookie and proxy rate limits isolate client IPs', async () => {
    const out=await req('/api/admin/logout',{method:'POST',cookie:admin})
    assert.equal(out.status,200)
    assert.match(out.headers.get('set-cookie'),/Max-Age=0/i)
    for(let i=0;i<5;i++)assert.equal((await req('/api/admin/login',{method:'POST',body:{password:'wrong'},headers:{'X-Real-IP':'192.0.2.1'}})).status,401)
    assert.equal((await req('/api/admin/login',{method:'POST',body:{password},headers:{'X-Real-IP':'192.0.2.1'}})).status,429)
    assert.equal((await req('/api/admin/login',{method:'POST',body:{password},headers:{'X-Real-IP':'192.0.2.2'}})).status,200)
    const attempts=await Promise.all(Array.from({length:5},()=>req('/api/admin/login',{method:'POST',body:{password:'wrong'},headers:{'X-Real-IP':'192.0.2.3'}})))
    assert.ok(attempts.every(r=>r.status===401))
    assert.equal((await req('/api/admin/login',{method:'POST',body:{password},headers:{'X-Real-IP':'192.0.2.3'}})).status,429)
  })
})

test('setup creates private configuration and refuses to overwrite existing secrets', async t => {
  const dir=await mkdtemp(join(tmpdir(),'chits-setup-'))
  t.after(()=>rm(dir,{recursive:true,force:true}))
  const script=new URL('../scripts/setup.mjs',import.meta.url)
  const first=spawnSync(process.execPath,[script.pathname],{cwd:dir,encoding:'utf8'})
  assert.equal(first.status,0)
  const before=await readFile(join(dir,'.env'),'utf8')
  assert.match(before,/SESSION_SECRET=[a-f0-9]{64}/)
  assert.match(before,/ADMIN_PASSWORD_HASH=[a-f0-9]{32}:[a-f0-9]{128}/)
  assert.equal((await stat(join(dir,'.env'))).mode & 0o777,0o600)
  const second=spawnSync(process.execPath,[script.pathname],{cwd:dir,encoding:'utf8'})
  assert.equal(second.status,1)
  assert.equal(await readFile(join(dir,'.env'),'utf8'),before)
})
