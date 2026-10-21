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
test('moderated feedback with persistent ten-hour visibility',{timeout:60_000},async t=>{
  const dir=await mkdtemp(join(tmpdir(),'chits-feedback-')),sqlite=join(dir,'test.sqlite')
  const reserve=createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening')
  const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve))
  const base=`http://127.0.0.1:${port}`,password=randomBytes(24).toString('hex'),salt=randomBytes(16).toString('hex')
  const env={...process.env,NODE_ENV:'production',NITRO_HOST:'127.0.0.1',NITRO_PORT:String(port),SQLITE_PATH:sqlite,SESSION_SECRET:randomBytes(32).toString('hex'),ADMIN_PASSWORD_HASH:`${salt}:${scryptSync(password,salt,64).toString('hex')}`,PUBLIC_ORIGIN:base,TRUST_PROXY:'1'}
  let child,db,ws,logs='',visitor,admin,postId,reviewId,expiry
  const events=[]
  async function req(path,{method='GET',cookie,body,headers={}}={}){
    return fetch(base+path,{method,headers:{...(method==='GET'?{}:{Origin:base,'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)})
  }
  const cookieOf=response=>response.headers.get('set-cookie').split(';')[0]
  async function start(){
    child=spawn(process.execPath,['.output/server/index.mjs'],{cwd:new URL('..',import.meta.url),env,stdio:['ignore','pipe','pipe']})
    child.stdout.on('data',data=>logs+=data);child.stderr.on('data',data=>logs+=data)
    for(let i=0;i<100;i++){
      try{if((await req('/api/admin/session')).ok)return}catch{}
      if(child.exitCode!==null)throw new Error('Feedback test server exited')
      await delay(30)
    }
    throw new Error('Feedback test server did not start')
  }
  async function stop(){if(child&&child.exitCode===null){const ended=once(child,'exit');child.kill();await ended}}
  async function joinVisitor(avatar='palitaw'){
    const response=await req('/api/visitors/join',{method:'POST',body:{avatar}});assert.equal(response.status,200);return cookieOf(response)
  }
  t.after(async()=>{ws?.terminate();db?.close();await stop();await rm(dir,{recursive:true,force:true});assert.doesNotMatch(logs,/\[uncaughtException\]|\[unhandledRejection\]/)})
  await start()
  visitor=await joinVisitor()
  const login=await req('/api/admin/login',{method:'POST',body:{password}});assert.equal(login.status,200);admin=cookieOf(login)
  db=new Database(sqlite)
  const visitorId=Number(visitor.split('.')[1])
  const submit=(cookie,body,headers)=>req('/api/feedback',{method:'POST',cookie,body,headers})
  const moderate=(id,action,options={})=>req(`/api/admin/feedback/${id}`,{method:'PATCH',cookie:admin,body:{action},...options})
  const publicPosts=()=>req('/api/feedback',{cookie:visitor}).then(r=>r.json())

  await t.test('feedback endpoints enforce sessions, admin scope, origins and bounded input',async()=>{
    assert.equal((await req('/api/feedback')).status,401)
    assert.equal((await submit(undefined,{kind:'review',text:'Anonymous'})).status,401)
    assert.equal((await submit(admin,{kind:'review',text:'Wrong scope'})).status,401)
    assert.equal((await req('/api/admin/feedback')).status,401)
    assert.equal((await req('/api/admin/feedback',{cookie:visitor})).status,401)
    assert.equal((await moderate(1,'approve',{cookie:visitor})).status,401)
    assert.equal((await submit(visitor,{kind:'review',text:'Bad origin'},{Origin:'https://attacker.example'})).status,403)
    assert.equal((await moderate(1,'approve',{headers:{Origin:'https://attacker.example'}})).status,403)
    for(const body of [null,[],{kind:'invalid',text:'Hello'},{kind:'review',text:42},{kind:'suggestion',text:'\u0000  '},{kind:'review',text:'x'.repeat(501)}])assert.equal((await submit(visitor,body)).status,400)
    assert.equal((await submit(visitor,{kind:'review',text:'x'.repeat(5000)})).status,413)
    assert.equal((await moderate('bad','approve')).status,400)
    assert.equal((await moderate(9999,'approve')).status,404)
  })
  await t.test('submissions are private pending posts with server-assigned identity and timestamps',async()=>{
    const response=await submit(visitor,{kind:'suggestion',text:'  More biko!\u0000\nSalamat!  ',nickname:'Staff',status:'approved',approvedAt:1,expiresAt:Date.now()+999999999})
    assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/)
    const result=await response.json();postId=result.id;assert.equal(result.status,'pending')
    assert.deepEqual((await publicPosts()).posts,[])
    const row=db.prepare('SELECT * FROM feedback WHERE id=?').get(postId)
    assert.equal(row.nickname,`Palitaw #${String(visitorId).padStart(3,'0')}`)
    assert.equal(row.text,'More biko!\nSalamat!');assert.equal(row.approved_at,null);assert.equal(row.expires_at,null)
    const state=await req('/api/admin/feedback',{cookie:admin}).then(r=>r.json())
    assert.equal(state.pendingCount,1);assert.equal(state.pending[0].id,postId);assert.deepEqual(state.published,[])
    assert.equal((await submit(visitor,{kind:'review',text:'Too soon'})).status,429)
  })
  await t.test('staff approval publishes for exactly ten hours and notifies connected visitors',async()=>{
    ws=new WebSocket(base.replace('http','ws')+'/ws',{headers:{Cookie:visitor,Origin:base}})
    ws.on('message',data=>events.push(JSON.parse(String(data))));await once(ws,'open')
    assert.equal((await moderate(postId,'invalid')).status,400)
    const response=await moderate(postId,'approve');assert.equal(response.status,200)
    const row=db.prepare('SELECT approved_at,expires_at FROM feedback WHERE id=?').get(postId)
    expiry=row.expires_at;assert.equal(expiry-row.approved_at,10*60*60_000)
    const state=await publicPosts();assert.equal(state.posts.length,1)
    assert.deepEqual(Object.keys(state.posts[0]).sort(),['approvedAt','expiresAt','id','kind','nickname','text'])
    for(let i=0;i<100&&!events.some(event=>event.type==='feedback_changed');i++)await delay(10)
    assert.ok(events.some(event=>event.type==='feedback_changed'))
    assert.equal((await moderate(postId,'approve')).status,200)
    assert.equal(db.prepare('SELECT expires_at FROM feedback WHERE id=?').get(postId).expires_at,expiry)
    ws.terminate();ws=undefined
  })
  await t.test('approval and its original expiry survive a server restart',async()=>{
    await stop();await start()
    const state=await publicPosts();assert.equal(state.posts[0].id,postId);assert.equal(state.posts[0].expiresAt,expiry)
    assert.equal((await req('/api/admin/feedback',{cookie:admin})).status,200)
  })
  await t.test('rejection and withdrawal keep posts private and cannot be reapproved',async()=>{
    const other=await joinVisitor('biko')
    const response=await submit(other,{kind:'review',text:'<b>Love the kakanin!</b>'});assert.equal(response.status,200);reviewId=(await response.json()).id
    assert.equal((await moderate(reviewId,'reject')).status,200)
    assert.equal((await moderate(reviewId,'approve')).status,409)
    assert.equal((await publicPosts()).posts.some(post=>post.id===reviewId),false)
    assert.equal((await moderate(postId,'reject')).status,200)
    assert.deepEqual((await publicPosts()).posts,[])
    assert.equal((await moderate(postId,'approve')).status,409)
    assert.equal(db.prepare('SELECT expires_at FROM feedback WHERE id=?').get(postId).expires_at,expiry)
    // Seed an approved boundary record without waiting ten real hours.
    db.prepare("UPDATE feedback SET status='approved',expires_at=? WHERE id=?").run(Date.now()+500,postId)
    assert.equal((await publicPosts()).posts.length,1)
    await delay(550)
    assert.deepEqual((await publicPosts()).posts,[])
    const expired=db.prepare('SELECT expires_at FROM feedback WHERE id=?').get(postId).expires_at
    assert.equal((await moderate(postId,'approve')).status,200)
    assert.equal(db.prepare('SELECT expires_at FROM feedback WHERE id=?').get(postId).expires_at,expired)
    assert.deepEqual((await publicPosts()).posts,[])
  })
  await t.test('visitor submission limits persist across restart and revocation blocks access',async()=>{
    db.prepare('UPDATE feedback SET created_at=? WHERE visitor_id=?').run(Date.now()-61_000,visitorId)
    for(let i=0;i<2;i++){
      assert.equal((await submit(visitor,{kind:'review',text:`Another visit ${i}`})).status,200)
      db.prepare('UPDATE feedback SET created_at=? WHERE visitor_id=?').run(Date.now()-61_000,visitorId)
    }
    assert.equal((await submit(visitor,{kind:'review',text:'Fourth post'})).status,429)
    await stop();await start()
    assert.equal((await submit(visitor,{kind:'review',text:'Restart bypass'})).status,429)
    db.prepare('UPDATE visitors SET revoked_at=? WHERE id=?').run(Date.now(),visitorId)
    assert.equal((await req('/api/feedback',{cookie:visitor})).status,401)
    assert.equal((await submit(visitor,{kind:'review',text:'Revoked'})).status,401)
  })
  await t.test('address-level limit bounds submissions from newly created visitor sessions',async()=>{
    for(let i=0;i<11;i++){
      const guest=await joinVisitor()
      const result=await submit(guest,{kind:'suggestion',text:`Guest idea ${i}`},{'X-Real-IP':'192.0.2.88'})
      assert.equal(result.status,i<10?200:429)
    }
  })
})
