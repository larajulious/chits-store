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
test('admin can selectively reset store data without touching credentials or store state',{timeout:45_000},async t=>{
  const dir=await mkdtemp(join(tmpdir(),'chits-admin-reset-')),sqlite=join(dir,'test.sqlite')
  const reserve=createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening')
  const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve))
  const base=`http://127.0.0.1:${port}`,password=randomBytes(24).toString('hex'),salt=randomBytes(16).toString('hex')
  const env={...process.env,NODE_ENV:'production',NITRO_HOST:'127.0.0.1',NITRO_PORT:String(port),SQLITE_PATH:sqlite,SESSION_SECRET:randomBytes(32).toString('hex'),ADMIN_PASSWORD_HASH:`${salt}:${scryptSync(password,salt,64).toString('hex')}`,PUBLIC_ORIGIN:base}
  let child,logs='',admin,visitor,ws,db
  const messages=[]
  const cookieOf=response=>response.headers.get('set-cookie').split(';')[0]
  async function req(path,{method='GET',cookie,body,headers={}}={}){
    return fetch(base+path,{method,headers:{...(method==='GET'?{}:{Origin:base,'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)})
  }
  const reset=(options,extra={})=>req('/api/admin/reset',{method:'POST',cookie:admin,body:{options,confirmation:'RESET'},...extra})
  async function waitFor(predicate){for(let i=0;i<200;i++){if(predicate())return;await delay(10)}assert.fail('Expected WebSocket event missing')}
  t.after(async()=>{ws?.terminate();if(child&&child.exitCode===null){const ended=once(child,'exit');child.kill();await ended}db?.close();await rm(dir,{recursive:true,force:true});assert.doesNotMatch(logs,/\[uncaughtException\]|\[unhandledRejection\]/)})
  child=spawn(process.execPath,['.output/server/index.mjs'],{cwd:new URL('..',import.meta.url),env,stdio:['ignore','pipe','pipe']})
  child.stdout.on('data',data=>logs+=data);child.stderr.on('data',data=>logs+=data)
  for(let i=0;i<100;i++){try{if((await req('/api/admin/session')).ok)break}catch{}await delay(30)}
  assert.equal((await req('/api/admin/session')).status,200)
  const login=await req('/api/admin/login',{method:'POST',body:{password}});assert.equal(login.status,200);admin=cookieOf(login)
  const joined=await req('/api/visitors/join',{method:'POST',body:{avatar:'palitaw'}});assert.equal(joined.status,200);visitor=cookieOf(joined)
  ws=new WebSocket(base.replace('http','ws')+'/ws',{headers:{Cookie:visitor,Origin:base}})
  ws.on('message',data=>messages.push(JSON.parse(String(data))))
  await once(ws,'open')
  assert.equal((await req('/api/admin/menu/today',{method:'POST',cookie:admin,body:{name:'Biko',priceCentavos:3500}})).status,200)
  assert.equal((await req('/api/admin/orders',{method:'POST',cookie:admin,body:{}})).status,200)
  assert.equal((await req('/api/feedback',{method:'POST',cookie:visitor,body:{kind:'review',text:'Great biko'}})).status,200)
  assert.equal((await req('/api/admin/chat',{method:'POST',cookie:admin,body:{text:'Hello everyone'}})).status,200)
  db=new Database(sqlite)
  db.prepare('INSERT INTO daily_menu(service_date,name,price_centavos,created_at,updated_at) VALUES(?,?,?,?,?)').run('2000-01-01','Old item',100,1,1)

  assert.equal((await reset(['menu'],{cookie:undefined})).status,401)
  assert.equal((await reset(['menu'],{cookie:visitor})).status,401)
  assert.equal((await reset(['menu'],{headers:{Origin:'https://attacker.example'}})).status,403)
  for(const options of [[],['menu','menu'],['unknown'],['orders','unknown'],'menu'])assert.equal((await reset(options)).status,400)
  assert.equal((await reset(['menu'],{body:{options:['menu'],confirmation:'NO'}})).status,400)
  assert.equal((await req('/api/menu/today').then(r=>r.json())).items.length,1)

  assert.equal((await reset(['menu'])).status,200)
  await waitFor(()=>messages.some(message=>message.type==='menu_changed'))
  const resetMenu=await req('/api/menu/today').then(r=>r.json())
  assert.equal(resetMenu.items.length,0)
  assert.ok(messages.some(message=>message.type==='menu:updated'&&message.version===resetMenu.version))
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM daily_menu').get().total,1)
  assert.equal((await req('/api/admin/orders',{cookie:admin}).then(r=>r.json())).length,1)
  assert.equal((await req('/api/admin/feedback',{cookie:admin}).then(r=>r.json())).pendingCount,1)

  assert.equal((await reset(['orders'])).status,200)
  await waitFor(()=>messages.some(message=>message.type==='order_changed'&&!message.order))
  assert.deepEqual(await req('/api/orders/board').then(r=>r.json()),[])
  const freshOrder=await req('/api/admin/orders',{method:'POST',cookie:admin,body:{}}).then(r=>r.json())
  assert.equal(freshOrder.order.number,'100')
  assert.equal((await req('/api/admin/feedback',{cookie:admin}).then(r=>r.json())).pendingCount,1)

  assert.equal((await reset(['feedback','chat'])).status,200)
  await waitFor(()=>messages.some(message=>message.type==='feedback_changed')&&messages.some(message=>message.type==='chat_reset'))
  assert.equal((await req('/api/admin/feedback',{cookie:admin}).then(r=>r.json())).pendingCount,0)
  assert.deepEqual((await req('/api/admin/chat',{cookie:admin}).then(r=>r.json())).messages,[])
  assert.equal((await req('/api/me',{cookie:visitor})).status,200)

  assert.equal((await reset(['visitors'])).status,200)
  await waitFor(()=>messages.some(message=>message.type==='choose_avatar'))
  assert.equal((await req('/api/me',{cookie:visitor})).status,401)
  const nextVisitor=await req('/api/visitors/join',{method:'POST',body:{avatar:'biko'}})
  assert.equal(nextVisitor.status,200)
  assert.notEqual(cookieOf(nextVisitor),visitor)
  assert.match((await req('/api/me',{cookie:cookieOf(nextVisitor)}).then(r=>r.json())).nickname,/#002$/)
  assert.deepEqual(await req('/api/store/status').then(r=>r.json()),{open:true})
  assert.equal((await req('/api/admin/session',{cookie:admin}).then(r=>r.json())).authenticated,true)
  assert.equal((await req('/api/admin/login',{method:'POST',body:{password}})).status,200)
})
