import { defineWebSocketHandler } from 'h3'
import { allowedOrigin, visitorSessionFromCookie, visitorName } from '../utils/auth'
import { joinRoom, leaveRoom, findMember, broadcast, publishChat, playerList, isChatEnabled, isMuted, authorized, recordInteraction } from '../utils/room'

export default defineWebSocketHandler({
  upgrade(request){
    if(!allowedOrigin(request.headers.get('origin'),request.headers.get('host')))return new Response('Invalid request origin',{status:403})
    if(!visitorSessionFromCookie(request.headers.get('cookie')||''))return new Response('Choose an avatar',{status:401})
  },
  open(peer) {
    const request = peer.request
    const origin = request?.headers.get('origin')
    const host = request?.headers.get('host')
    // Require same-origin WebSocket upgrade for public visitors.
    if(!allowedOrigin(origin,host)){peer.close();return}
    const session=visitorSessionFromCookie(request?.headers.get('cookie')||'')
    const visitor=session?.visitor
    if (!visitor) { peer.send(JSON.stringify({type:'choose_avatar'})); peer.close(); return }
    joinRoom({ id:peer.id, visitorId:visitor.id, expiresAt:session!.expiresAt, nickname:visitorName(visitor), avatar:visitor.avatar_key,
      x:180, y:510, lastMove:Date.now(), lastChat:0, chatWindowStart:Date.now(), chatCount:0,
      send:payload => peer.send(payload), close:()=>peer.close() })
  },
  message(peer, message) {
    const p = findMember(peer.id)
    if (!p || !authorized(p)) { peer.send(JSON.stringify({type:'choose_avatar'}));leaveRoom(peer.id);peer.close();return }
    const now=Date.now(),rate=peer.context.rate as {at:number;count:number}|undefined
    if(!rate||now-rate.at>=1000)peer.context.rate={at:now,count:1}
    else if(++rate.count>40){leaveRoom(peer.id);peer.close(1008,'Message rate exceeded');return}
    if (message.text().length > 1000) return
    let data: { type?:string; text?:string; x?:number; y?:number; emoji?:string }
    try { const parsed:unknown=JSON.parse(message.text());if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return;data=parsed } catch { return }
    if (data.type === 'move') {
      const x=data.x, y=data.y, now=Date.now()
      if (typeof x!=='number'||typeof y!=='number'||!Number.isFinite(x)||!Number.isFinite(y)||x<20||x>340||y<260||y>542) return
      if (now - p.lastMove < 65) return
      const maxDistance = Math.max(18,(now-p.lastMove)*0.24)
      if (Math.hypot(x-p.x,y-p.y) > maxDistance) return
      p.x=x; p.y=y; p.lastMove=now
      broadcast({type:'player_moved',id:p.id,x,y})
    } else if (data.type === 'chat') {
      if (!isChatEnabled() || isMuted(p.visitorId)) { peer.send(JSON.stringify({type:'chat_blocked'})); return }
      if(typeof data.text!=='string')return
      const text=data.text.normalize('NFKC').replace(/[\p{C}]/gu,'').trim()
      const now=Date.now()
      if (!text || text.length>160 || now-p.lastChat<1500) return
      if (now-p.chatWindowStart>60_000) { p.chatWindowStart=now; p.chatCount=0 }
      ++p.chatCount;recordInteraction(p)
      if (p.chatCount>20) { peer.send(JSON.stringify({type:'chat_slow_down'})); return }
      p.lastChat=now
      recordInteraction(p)
      publishChat({id:p.id,nickname:p.nickname,text,at:now,role:'visitor'})
    } else if (data.type === 'emote') {
      if(!isChatEnabled()||isMuted(p.visitorId)){peer.send(JSON.stringify({type:'chat_blocked'}));return}
      if(typeof data.emoji!=='string')return
      const emoji=data.emoji
      const now=Date.now()
      if (!['👋','❤️','😂','✨'].includes(emoji) || now-p.lastChat<1000) return
      p.lastChat=now
      recordInteraction(p)
      broadcast({type:'emote',id:p.id,emoji})
    } else if (data.type==='ping') {
      peer.send(JSON.stringify({type:'pong',count:playerList().length}))
    }
  },
  close(peer) { leaveRoom(peer.id) },
  error(peer) { leaveRoom(peer.id) },
})
