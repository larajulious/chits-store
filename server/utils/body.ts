import { createError, getHeader, setHeader, type H3Event } from 'h3'

export async function readJsonBody<T extends object>(event:H3Event):Promise<T> {
  if (getHeader(event,'content-type')?.split(';')[0]?.trim()!=='application/json') throw createError({statusCode:415,statusMessage:'JSON body required'})
  const limit=4096, chunks:Buffer[]=[]
  if (Number(getHeader(event,'content-length'))>limit) {
    setHeader(event,'Connection','close')
    throw createError({statusCode:413,statusMessage:'Request body too large'})
  }
  let size=0
  // Avoid destroying the request before Nitro's response-finish hook runs.
  for await (const chunk of event.node.req.iterator({destroyOnReturn:false})) {
    const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk)
    size+=bytes.length
    if(size>limit){setHeader(event,'Connection','close');throw createError({statusCode:413,statusMessage:'Request body too large'})}
    chunks.push(bytes)
  }
  let body:unknown
  try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw createError({statusCode:400,statusMessage:'Invalid JSON body'})}
  if(!body||typeof body!=='object'||Array.isArray(body))throw createError({statusCode:400,statusMessage:'JSON object required'})
  return body as T
}
