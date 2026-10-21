import {test} from 'node:test'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtemp,writeFile,symlink,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {randomBytes,scryptSync,createHmac} from 'node:crypto'
import {createServer} from 'node:http'
import {once} from 'node:events'

const root=fileURLToPath(new URL('..',import.meta.url))
const launcher=fileURLToPath(new URL('../scripts/start.mjs',import.meta.url))
const secret=randomBytes(32).toString('hex'),salt=randomBytes(16).toString('hex')
const password=randomBytes(24).toString('hex')
const hash=`${salt}:${scryptSync(password,salt,64).toString('hex')}`

async function fixture(t,contents='') {
  const dir=await mkdtemp(join(tmpdir(),'chits-start-'))
  await writeFile(join(dir,'.env'),contents,{mode:0o600})
  await symlink(join(root,'.output'),join(dir,'.output'),'dir')
  const children=[]
  t.after(async()=>{
    for(const child of children)if(child.exitCode===null){const ended=once(child,'exit');child.kill();await ended}
    await rm(dir,{recursive:true,force:true})
  })
  const env={...process.env}
  for(const key of ['SESSION_SECRET','ADMIN_PASSWORD_HASH','PUBLIC_ORIGIN','SQLITE_PATH','NODE_ENV','NODE_OPTIONS','HOST','PORT','NITRO_HOST','NITRO_PORT']) delete env[key]
  return {dir,env,children}
}

async function exits(dir,env) {
  const child=spawn(process.execPath,[launcher],{cwd:dir,env,stdio:['ignore','pipe','pipe']})
  let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d)
  const [code]=await once(child,'exit')
  return {code,logs}
}

test('production start rejects missing signing key without exposing configuration', {timeout:10_000},async t=>{
  const {dir,env}=await fixture(t,`ADMIN_PASSWORD_HASH=${hash}\n`)
  const result=await exits(dir,env)
  assert.equal(result.code,1);assert.match(result.logs,/SESSION_SECRET is missing or invalid/)
  assert.equal(result.logs.includes(hash),false)
})

test('production start rejects missing admin hash without changing credentials', {timeout:10_000},async t=>{
  const contents=`SESSION_SECRET=${secret}\n`
  const {dir,env}=await fixture(t,contents)
  const result=await exits(dir,env)
  assert.equal(result.code,1);assert.match(result.logs,/ADMIN_PASSWORD_HASH is missing or invalid/)
  assert.equal(result.logs.includes(secret),false)
  const {readFile}=await import('node:fs/promises')
  assert.equal(await readFile(join(dir,'.env'),'utf8'),contents)
})

async function starts(t,override=false) {
  const fileSecret=override?randomBytes(32).toString('hex'):secret
  const {dir,env,children}=await fixture(t,`NODE_ENV=development\nSESSION_SECRET=${fileSecret}\nADMIN_PASSWORD_HASH=${hash}\n`)
  const reserve=createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening')
  const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve))
  Object.assign(env,{HOST:'127.0.0.1',PORT:String(port),SQLITE_PATH:join(dir,'test.sqlite')})
  if(override) env.SESSION_SECRET=secret
  const child=spawn(process.execPath,[launcher],{cwd:dir,env,stdio:['ignore','pipe','pipe']})
  children.push(child)
  let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d)
  const base=`http://127.0.0.1:${port}`
  let listening=false
  for(let i=0;i<100;i++){
    if(child.exitCode!==null)assert.fail('Production launcher exited before serving requests')
    try{if((await fetch(base+'/api/admin/session')).ok){listening=true;break}}catch{}
    await new Promise(resolve=>setTimeout(resolve,50))
  }
  assert.equal(listening,true)
  const headers={Origin:base,'Content-Type':'application/json'}
  const joined=await fetch(base+'/api/visitors/join',{method:'POST',headers,body:JSON.stringify({avatar:'palitaw'})})
  assert.equal(joined.status,200)
  const cookie=joined.headers.get('set-cookie')
  assert.match(cookie,/; Secure/i);assert.match(cookie,/; HttpOnly/i)
  const value=decodeURIComponent(cookie.split(';')[0].slice('chits_visitor='.length))
  const parts=value.split('.'),signature=parts.pop()
  assert.equal(signature,createHmac('sha256',secret).update(parts.join('.')).digest('hex'))
  const me=await fetch(base+'/api/me',{headers:{Cookie:cookie.split(';')[0]}})
  assert.equal(me.status,200);assert.equal((await me.json()).avatar,'palitaw')
  const login=await fetch(base+'/api/admin/login',{method:'POST',headers,body:JSON.stringify({password})})
  assert.equal(login.status,200)
  assert.equal(logs.includes(secret),false);assert.equal(logs.includes(hash),false)
}

test('production start loads existing .env; entry, session and admin login work with secure cookies',{timeout:15_000},t=>starts(t))
test('production start preserves process-manager signing key over .env',{timeout:15_000},t=>starts(t,true))
