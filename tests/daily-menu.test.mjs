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
test('daily menu is staff-managed, public, date-scoped and persistent',{timeout:45_000},async t=>{
  const dir=await mkdtemp(join(tmpdir(),'chits-daily-menu-')),sqlite=join(dir,'test.sqlite')
  const reserve=createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening')
  const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve))
  const base=`http://127.0.0.1:${port}`,password=randomBytes(24).toString('hex'),salt=randomBytes(16).toString('hex')
  const env={...process.env,NODE_ENV:'production',NITRO_HOST:'127.0.0.1',NITRO_PORT:String(port),SQLITE_PATH:sqlite,SESSION_SECRET:randomBytes(32).toString('hex'),ADMIN_PASSWORD_HASH:`${salt}:${scryptSync(password,salt,64).toString('hex')}`,PUBLIC_ORIGIN:base}
  let child,logs='',admin,visitor,ws,db
  const events=[]
  async function req(path,{method='GET',cookie,body,headers={}}={}){
    return fetch(base+path,{method,headers:{...(method==='GET'?{}:{Origin:base,'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)})
  }
  const cookieOf=response=>response.headers.get('set-cookie').split(';')[0]
  async function start(){
    child=spawn(process.execPath,['.output/server/index.mjs'],{cwd:new URL('..',import.meta.url),env,stdio:['ignore','pipe','pipe']})
    child.stdout.on('data',data=>logs+=data);child.stderr.on('data',data=>logs+=data)
    for(let i=0;i<100;i++){
      try{if((await req('/api/menu/today')).ok)return}catch{}
      if(child.exitCode!==null)throw new Error('Daily menu server exited')
      await delay(30)
    }
    throw new Error('Daily menu server did not start')
  }
  async function stop(){if(child&&child.exitCode===null){const ended=once(child,'exit');child.kill();await ended}}
  const change=(method,body,options={})=>req('/api/admin/menu/today',{method,cookie:admin,body,...options})
  t.after(async()=>{ws?.terminate();db?.close();await stop();await rm(dir,{recursive:true,force:true});assert.doesNotMatch(logs,/\[uncaughtException\]|\[unhandledRejection\]/)})
  await start()
  const empty=await req('/api/menu/today');assert.equal(empty.status,200);assert.match(empty.headers.get('cache-control'),/no-store/)
  const initial=await empty.json();assert.match(initial.date,/^\d{4}-\d{2}-\d{2}$/);assert.deepEqual(initial.items,[])
  assert.equal((await req('/api/admin/menu/today')).status,401)
  assert.equal((await change('POST',{name:'Biko',priceCentavos:3500},{cookie:undefined})).status,401)
  const login=await req('/api/admin/login',{method:'POST',body:{password}});assert.equal(login.status,200);admin=cookieOf(login)
  const guest=await req('/api/visitors/join',{method:'POST',body:{avatar:'palitaw'}});assert.equal(guest.status,200);visitor=cookieOf(guest)
  assert.equal((await change('POST',{name:'Biko',priceCentavos:3500},{cookie:visitor})).status,401)
  assert.equal((await change('POST',{name:'Biko',priceCentavos:3500},{headers:{Origin:'https://attacker.example'}})).status,403)
  for(const body of [{name:'',priceCentavos:100},{name:'x'.repeat(61),priceCentavos:100},{name:'Bad\u0000',priceCentavos:100},{name:'Biko',priceCentavos:0},{name:'Biko',priceCentavos:1.5},{name:'Biko',priceCentavos:1000001},null,[]])assert.equal((await change('POST',body)).status,400)
  assert.equal((await change('POST',{name:'x'.repeat(5000),priceCentavos:100})).status,413)
  ws=new WebSocket(base.replace('http','ws')+'/ws',{headers:{Cookie:visitor,Origin:base}})
  ws.on('message',data=>events.push(JSON.parse(String(data))));await once(ws,'open')
  const added=await change('POST',{name:'  Palitaw  ',priceCentavos:3500,serviceDate:'2099-01-01'})
  assert.equal(added.status,200);const first=await added.json()
  assert.equal(first.date,initial.date);assert.deepEqual(first.items.map(({name,priceCentavos})=>({name,priceCentavos})),[{name:'Palitaw',priceCentavos:3500}])
  const id=first.items[0].id
  assert.deepEqual(await req('/api/menu/today').then(r=>r.json()),first)
  for(let i=0;i<100&&!events.some(event=>event.type==='menu_changed');i++)await delay(10)
  assert.ok(events.some(event=>event.type==='menu_changed'))
  assert.equal((await change('PATCH',{id,name:'Palitaw',priceCentavos:0})).status,400)
  assert.equal((await change('PATCH',{id:9999,name:'Biko',priceCentavos:5500})).status,404)
  const changed=await change('PATCH',{id,name:'Biko',priceCentavos:5500});assert.equal(changed.status,200)
  assert.deepEqual((await changed.json()).items,[{id,name:'Biko',priceCentavos:5500}])
  await stop();await start()
  assert.deepEqual((await req('/api/menu/today').then(r=>r.json())).items,[{id,name:'Biko',priceCentavos:5500}])
  db=new Database(sqlite)
  db.prepare('UPDATE daily_menu SET service_date=? WHERE id=?').run('2000-01-01',id)
  assert.deepEqual((await req('/api/menu/today').then(r=>r.json())).items,[])
  assert.equal((await change('PATCH',{id,name:'Old item',priceCentavos:10})).status,404)
  assert.equal((await change('DELETE',{id})).status,404)
  assert.equal(db.prepare('SELECT name FROM daily_menu WHERE id=?').get(id).name,'Biko')
  const today=await change('POST',{name:'Maja blanca',priceCentavos:4250});assert.equal(today.status,200)
  const newId=(await today.json()).items[0].id
  assert.equal((await change('DELETE',{id:newId})).status,200)
  assert.deepEqual((await req('/api/menu/today').then(r=>r.json())).items,[])
})
