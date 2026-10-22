import { createReadStream, statSync } from 'node:fs'
import { createError, defineEventHandler, getHeader, getQuery, getRouterParam, send, sendStream, setHeaders, setResponseStatus } from 'h3'
import { jukeboxAudioFile } from '../../../utils/jukebox'

// Music is ordinary HTTP audio, never WebSocket data. Byte ranges let browsers start mid-track,
// and iOS Safari will not play <audio> from a server that ignores them.
export default defineEventHandler(event=>{
  if(event.method!=='GET'&&event.method!=='HEAD')throw createError({statusCode:405,statusMessage:'Method not allowed'})
  let name=''
  try{name=decodeURIComponent(getRouterParam(event,'file')||'')}catch{}
  const file=jukeboxAudioFile(name)
  let stat
  try{stat=file&&statSync(file.path)}catch{}
  if(!file||!stat||!stat.isFile())throw createError({statusCode:404,statusMessage:'Track not found'})
  const size=stat.size,etag=`"${size.toString(36)}-${Math.floor(stat.mtimeMs).toString(36)}"`
  // Track URLs carry the file version, so a versioned request can be cached for good.
  setHeaders(event,{'Content-Type':'audio/mpeg','Accept-Ranges':'bytes',ETag:etag,'Last-Modified':stat.mtime.toUTCString(),
    'Cache-Control':getQuery(event).v===file.version?'public, max-age=31536000, immutable':'no-cache'})
  const range=getHeader(event,'range')
  if(!range&&getHeader(event,'if-none-match')===etag){setResponseStatus(event,304);return send(event,'')}
  let start=0,end=size-1
  if(range){
    const match=/^bytes=(\d*)-(\d*)$/.exec(range.trim())
    if(match&&match[1]==='')start=Math.max(0,size-Number(match[2]))
    else if(match){start=Number(match[1]);if(match[2])end=Math.min(Number(match[2]),size-1)}
    if(!match||(!match[1]&&!match[2])||start>end||start>=size){
      setHeaders(event,{'Content-Range':`bytes */${size}`})
      throw createError({statusCode:416,statusMessage:'Range not satisfiable'})
    }
    setResponseStatus(event,206)
    setHeaders(event,{'Content-Range':`bytes ${start}-${end}/${size}`})
  }
  setHeaders(event,{'Content-Length':String(end-start+1)})
  if(event.method==='HEAD')return send(event,'')
  return sendStream(event,createReadStream(file.path,{start,end}))
})
