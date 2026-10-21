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

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))
test('automatic order numbers from 100 (isolated SQLite)',{timeout:30_000},async t=>{
  const dir=await mkdtemp(join(tmpdir(),'chits-order-numbers-')),sqlite=join(dir,'test.sqlite')
  const db=new Database(sqlite)
  db.exec("CREATE TABLE orders(id INTEGER PRIMARY KEY AUTOINCREMENT,order_number TEXT NOT NULL UNIQUE,status TEXT NOT NULL DEFAULT 'Preparing' CHECK(status IN ('Preparing','Ready','Served')),token_hash TEXT NOT NULL UNIQUE,nickname TEXT,avatar_key TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,served_at INTEGER,revoked_at INTEGER)")
  db.prepare('INSERT INTO orders(order_number,token_hash,nickname,created_at,updated_at) VALUES(?,?,?,?,?)').run('101','legacy-token','Saved customer',100,100)
  const legacy=db.prepare('SELECT * FROM orders WHERE id=1').get()
  const reserve=createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening')
  const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve))
  const base=`http://127.0.0.1:${port}`,password=randomBytes(24).toString('hex'),salt=randomBytes(16).toString('hex')
  const env={...process.env,NODE_ENV:'production',NITRO_HOST:'127.0.0.1',NITRO_PORT:String(port),SQLITE_PATH:sqlite,SESSION_SECRET:randomBytes(32).toString('hex'),ADMIN_PASSWORD_HASH:`${salt}:${scryptSync(password,salt,64).toString('hex')}`,PUBLIC_ORIGIN:base}
  let child,logs='',admin
  async function req(path,{method='GET',cookie,body,headers={}}={}){
    return fetch(base+path,{method,headers:{...(method==='GET'?{}:{Origin:base,'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)})
  }
  async function start(){
    child=spawn(process.execPath,['.output/server/index.mjs'],{cwd:new URL('..',import.meta.url),env,stdio:['ignore','pipe','pipe']})
    child.stdout.on('data',data=>logs+=data);child.stderr.on('data',data=>logs+=data)
    for(let i=0;i<100;i++){
      try{if((await req('/api/admin/session')).ok)return}catch{}
      if(child.exitCode!==null)throw new Error('Order numbering test server exited')
      await delay(30)
    }
    throw new Error('Order numbering test server did not start')
  }
  async function stop(){if(child&&child.exitCode===null){const ended=once(child,'exit');child.kill();await ended}}
  const create=(options={})=>req('/api/admin/orders',{method:'POST',cookie:admin,body:{},...options})
  function assertLegacy(){const {delivered_at,...fields}=db.prepare('SELECT * FROM orders WHERE id=1').get();assert.equal(delivered_at,null);assert.deepEqual(fields,legacy)}
  t.after(async()=>{await stop();db.close();await rm(dir,{recursive:true,force:true});assert.doesNotMatch(logs,/\[uncaughtException\]|\[unhandledRejection\]/)})
  await start()
  const login=await req('/api/admin/login',{method:'POST',body:{password}});assert.equal(login.status,200);admin=login.headers.get('set-cookie').split(';')[0]
  assert.equal((await req('/api/admin/orders',{cookie:admin})).status,200)

  await t.test('only valid same-origin staff requests allocate numbers',async()=>{
    assert.equal((await create({cookie:undefined})).status,401)
    const joined=await req('/api/visitors/join',{method:'POST',body:{avatar:'biko'}})
    assert.equal((await create({cookie:joined.headers.get('set-cookie').split(';')[0]})).status,401)
    assert.equal((await create({headers:{Origin:'https://attacker.example'}})).status,403)
    for(const body of [null,[]])assert.equal((await create({body})).status,400)
    assert.equal((await create({body:{number:'x'.repeat(5000)}})).status,413)
    for(const name of [42,null,'x'.repeat(61),'Two\nlines'])assert.equal((await create({body:{name}})).status,400)
    assert.equal(db.prepare('SELECT COUNT(*) AS total FROM order_sequence').get().total,0)
  })
  await t.test('numbers start at 100, ignore caller overrides and skip existing numbers',async()=>{
    const first=await create({body:{number:'CLIENT-OVERRIDE',name:'  María Dela Cruz  '}});assert.equal(first.status,200)
    const result=await first.json();assert.equal(result.order.number,'100');assert.equal(result.order.status,'Preparing');assert.equal(result.order.name,'María Dela Cruz');assert.equal('link' in result,false)
    assert.equal(db.prepare("SELECT nickname FROM orders WHERE order_number='100'").get().nickname,'María Dela Cruz')
    const adminOrders=await req('/api/admin/orders',{cookie:admin}).then(response=>response.json())
    assert.equal(adminOrders.find(order=>order.number==='100').name,'María Dela Cruz')
    const publicOrders=await req('/api/orders/board').then(response=>response.json())
    assert.equal(publicOrders.find(order=>order.number==='100').name,'María Dela Cruz')
    assert.deepEqual(Object.keys(publicOrders.find(order=>order.number==='100')).sort(),['id','name','number','status'])
    const next=await create({body:{name:'   '}});assert.equal(next.status,200);const unnamed=await next.json();assert.equal(unnamed.order.number,'102');assert.equal(unnamed.order.name,null)
    assert.equal((await req('/api/orders/board').then(response=>response.json())).find(order=>order.number==='102').name,null)
    assert.equal(db.prepare("SELECT COUNT(*) AS total FROM orders WHERE order_number='CLIENT-OVERRIDE'").get().total,0)
    assertLegacy()
  })
  await t.test('concurrent staff creates receive distinct consecutive numbers',async()=>{
    const responses=await Promise.all(Array.from({length:12},()=>create()))
    for(const response of responses)assert.equal(response.status,200)
    const numbers=await Promise.all(responses.map(async response=>Number((await response.json()).order.number)))
    assert.deepEqual(numbers.sort((a,b)=>a-b),Array.from({length:12},(_,index)=>103+index))
  })
  await t.test('failed order insertion rolls back its number allocation',async()=>{
    db.exec("CREATE TRIGGER fail_test_order BEFORE INSERT ON orders WHEN NEW.order_number='115' BEGIN SELECT RAISE(ABORT,'test order insert failure'); END")
    const before=db.prepare('SELECT COUNT(*) AS total FROM orders').get().total
    assert.equal((await create()).status,409)
    assert.equal(db.prepare('SELECT COUNT(*) AS total FROM orders').get().total,before)
    assert.equal(db.prepare('SELECT next_number FROM order_sequence WHERE id=1').get().next_number,115)
    db.exec('DROP TRIGGER fail_test_order')
    const retry=await create();assert.equal(retry.status,200);assert.equal((await retry.json()).order.number,'115')
  })
  await t.test('the sequence survives restart and does not reuse deleted automatic numbers',async()=>{
    await stop();await start()
    assert.equal(db.prepare("SELECT nickname FROM orders WHERE order_number='100'").get().nickname,'María Dela Cruz')
    const result=await create();assert.equal(result.status,200)
    const {order}=await result.json();assert.equal(order.number,'116')
    db.prepare('DELETE FROM orders WHERE id=?').run(order.id)
    const next=await create();assert.equal(next.status,200);assert.equal((await next.json()).order.number,'117')
    assertLegacy()
  })
})
