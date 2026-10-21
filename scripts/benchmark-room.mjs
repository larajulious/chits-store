// Local-only room benchmark. Runs the current production build against disposable SQLite.
// Run `npm run build && node scripts/benchmark-room.mjs`; never point this at live data.
// Set CHITS_BENCH_APP_ROOT to benchmark a separate built checkout with this same driver.
import {spawn,execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {createServer} from 'node:http'
import {once} from 'node:events'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {randomBytes,scryptSync} from 'node:crypto'
import WebSocket from 'ws'

const run=promisify(execFile),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const dir=await mkdtemp(join(tmpdir(),'chits-room-bench-'))
const appRoot=process.env.CHITS_BENCH_APP_ROOT||new URL('..',import.meta.url)
const listener=createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening')
const port=listener.address().port;await new Promise(resolve=>listener.close(resolve))
const origin=`http://127.0.0.1:${port}`,salt=randomBytes(16).toString('hex')
const child=spawn(process.execPath,['.output/server/index.mjs'],{cwd:appRoot,env:{...process.env,NODE_ENV:'production',NITRO_HOST:'127.0.0.1',NITRO_PORT:String(port),SQLITE_PATH:join(dir,'benchmark.sqlite'),SESSION_SECRET:randomBytes(32).toString('hex'),ADMIN_PASSWORD_HASH:`${salt}:${scryptSync(randomBytes(20),salt,64).toString('hex')}`,PUBLIC_ORIGIN:origin,TRUST_PROXY:'1'},stdio:['ignore','pipe','pipe']})
let logs='';child.stdout.on('data',chunk=>logs+=chunk);child.stderr.on('data',chunk=>logs+=chunk)
const clients=[]
try{
  for(let i=0;i<120;i++){try{if((await fetch(origin+'/api/store/status')).ok)break}catch{}if(child.exitCode!==null)throw Error('Server exited');if(i===119)throw Error('Server did not start');await sleep(50)}
  async function memoryKiB(){const {stdout}=await run('ps',['-p',String(child.pid),'-o','rss=']);return Number(stdout.trim())}
  async function cpuMs(){
    const {stdout}=await run('ps',['-p',String(child.pid),'-o','time='])
    const parts=stdout.trim().split(':').map(Number)
    return (parts.length===3?parts[0]*3600+parts[1]*60+parts[2]:parts[0]*60+parts[1])*1000
  }
  async function createVisitor(i){
    const response=await fetch(origin+'/api/visitors/join',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Real-IP':`192.0.2.${i+1}`},body:JSON.stringify({avatar:i%2?'biko':'palitaw'})})
    if(!response.ok)throw Error(`Visitor ${i} join HTTP ${response.status}`)
    const cookie=response.headers.get('set-cookie')?.split(';')[0]
    const socket=new WebSocket(origin.replace('http','ws')+'/ws',{headers:{Cookie:cookie,Origin:origin}})
    const client={socket,welcomed:false,full:false,messages:0,mascot:0}
    clients.push(client)
    socket.on('message',data=>{const event=JSON.parse(String(data));client.messages++;if(event.type==='mascot')client.mascot++;if(event.type==='welcome')client.welcomed=true;if(event.type==='room_full')client.full=true})
    socket.on('error',()=>{})
    await once(socket,'open')
  }
  const rows=[]
  for(const target of [0,1,10,25,50,100]){
    for(let i=clients.length;i<target;i++)await createVisitor(i)
    await sleep(200)
    if(target){
      const owner=clients.find(client=>client.welcomed)
      owner.socket.send(JSON.stringify({type:'yarn_pickup'}))
      owner.socket.send(JSON.stringify({type:'yarn_drag',x:175,y:440}))
      owner.socket.send(JSON.stringify({type:'yarn_release',x:175,y:440,vx:110,vy:0}))
      await sleep(80)
    }
    const before=clients.map(client=>({messages:client.messages,mascot:client.mascot})),cpuBefore=await cpuMs()
    const started=Date.now()
    await sleep(1200)
    const seconds=(Date.now()-started)/1000
    rows.push({requested:target,accepted:clients.filter(client=>client.welcomed).length,roomFull:clients.filter(client=>client.full).length,rssMiB:Math.round(await memoryKiB()/1024),cpuPercent:+((await cpuMs()-cpuBefore)/(seconds*10)).toFixed(1),messagesPerSecond:+(clients.reduce((total,client,i)=>total+client.messages-before[i].messages,0)/seconds).toFixed(1),mascotMessagesPerSecond:+(clients.reduce((total,client,i)=>total+client.mascot-before[i].mascot,0)/seconds).toFixed(1)})
  }
  console.log(JSON.stringify({platform:process.platform,node:process.version,sampleSeconds:1.2,rows},null,2))
}finally{
  for(const client of clients)client.socket.terminate()
  if(child.exitCode===null){const ended=once(child,'exit');child.kill();await ended}
  await rm(dir,{recursive:true,force:true})
  if(/uncaughtException|unhandledRejection/.test(logs))console.error(logs)
}
