import {test} from 'node:test'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {randomBytes,scryptSync} from 'node:crypto'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createServer} from 'node:http'
import {once} from 'node:events'
import WebSocket from 'ws'

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))
test('cat tap counts are shared, survive restarts and are never reset',{timeout:60_000},async t=>{
  const dir=await mkdtemp(join(tmpdir(),'chits-cat-taps-')),sqlite=join(dir,'test.sqlite')
  const reserve=createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening')
  const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve))
  const base=`http://127.0.0.1:${port}`,password=randomBytes(24).toString('hex'),salt=randomBytes(16).toString('hex')
  const env={...process.env,NODE_ENV:'production',NITRO_HOST:'127.0.0.1',NITRO_PORT:String(port),SQLITE_PATH:sqlite,SESSION_SECRET:randomBytes(32).toString('hex'),ADMIN_PASSWORD_HASH:`${salt}:${scryptSync(password,salt,64).toString('hex')}`,PUBLIC_ORIGIN:base}
  let child,logs=''
  const sockets=[]
  const cookieOf=response=>response.headers.get('set-cookie').split(';')[0]
  const req=(path,{method='GET',cookie,body}={})=>fetch(base+path,{method,headers:{...(method==='GET'?{}:{Origin:base,'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)})
  async function start(){
    child=spawn(process.execPath,['.output/server/index.mjs'],{cwd:new URL('..',import.meta.url),env,stdio:['ignore','pipe','pipe']})
    child.stdout.on('data',data=>logs+=data);child.stderr.on('data',data=>logs+=data)
    for(let i=0;i<100;i++){try{if((await req('/api/store/status')).ok)return}catch{}await delay(30)}
    assert.fail('Server did not start')
  }
  async function stop(){if(child&&child.exitCode===null){const ended=once(child,'exit');child.kill();await ended}}
  async function visit(){
    const joined=await req('/api/visitors/join',{method:'POST',body:{avatar:'mochi'}});assert.equal(joined.status,200)
    const ws=new WebSocket(base.replace('http','ws')+'/ws',{headers:{Cookie:cookieOf(joined),Origin:base}}),messages=[]
    ws.on('message',data=>messages.push(JSON.parse(String(data))));sockets.push(ws)
    await once(ws,'open')
    return {ws,messages,latest:()=>messages.filter(message=>message.type==='cat_taps').at(-1)?.taps}
  }
  async function waitFor(predicate){for(let i=0;i<300;i++){if(predicate())return;await delay(10)}assert.fail('Expected cat_taps message missing')}
  t.after(async()=>{for(const ws of sockets)ws.terminate();await stop();await rm(dir,{recursive:true,force:true});assert.doesNotMatch(logs,/\[uncaughtException\]|\[unhandledRejection\]/)})

  await start()
  const a=await visit(),b=await visit()
  await waitFor(()=>a.latest()&&b.latest())
  assert.deepEqual(b.latest(),{Miming:0,Onay:0})
  for(let i=0;i<3;i++){a.ws.send(JSON.stringify({type:'cat_tap',name:'Miming'}));await delay(80)}
  b.ws.send(JSON.stringify({type:'cat_tap',name:'Onay'}))
  // Unknown cats and taps faster than a person can tap are ignored.
  b.ws.send(JSON.stringify({type:'cat_tap',name:'Onay'}))
  b.ws.send(JSON.stringify({type:'cat_tap',name:'Garfield'}))
  await waitFor(()=>a.latest()?.Miming===3&&a.latest()?.Onay===1)
  await delay(400)
  assert.deepEqual(b.latest(),{Miming:3,Onay:1})

  const login=await req('/api/admin/login',{method:'POST',body:{password}});assert.equal(login.status,200)
  const reset=await req('/api/admin/reset',{method:'POST',cookie:cookieOf(login),body:{options:['menu','orders','feedback','chat','visitors'],confirmation:'RESET'}})
  assert.equal(reset.status,200)
  for(const ws of sockets)ws.terminate()
  await stop()
  await start()
  const later=await visit()
  await waitFor(()=>later.latest())
  assert.deepEqual(later.latest(),{Miming:3,Onay:1})
})
