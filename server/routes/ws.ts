import { defineWebSocketHandler } from 'h3'
import { allowedOrigin, visitorSessionFromCookie, visitorName } from '../utils/auth'
import { joinRoom, leaveRoom, findMember, broadcastScene, publishChat, onlineCount, isChatEnabled, isMuted, authorized, recordInteraction, changeScene, sitDown, standUp } from '../utils/room'
import { isScene, isSeat, onSceneFloor, scenes, type SceneId } from '../../shared/world'
import {isStoreOpen} from '../utils/store'
import {jukeboxState, jukeboxVoteOf, voteJukebox} from '../utils/jukebox'
import {catTaps, isCatName, tapCat} from '../utils/cat-taps'

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
    // A refresh or reconnect keeps the visitor in the scene they were in (/ws?scene=outside); new visits start inside.
    // While the store is closed everyone lands on the street.
    let scene:SceneId='store'
    try{const wanted=new URL(request?.url||'/ws','http://localhost').searchParams.get('scene');if(isScene(wanted))scene=wanted}catch{}
    if(!isStoreOpen())scene='outside'
    const {x,y}=scenes[scene].spawn
    joinRoom({ id:peer.id, visitorId:visitor.id, expiresAt:session!.expiresAt, nickname:visitorName(visitor), avatar:visitor.avatar_key,
      scene, x, y, pose:'stand', seat:null, lastSceneChange:0, lastMove:Date.now(), lastChat:0, chatWindowStart:Date.now(), chatCount:0,
      send:payload => peer.send(payload), close:()=>peer.close() })
    // Late joiners and reconnects get the shared timeline once; later changes arrive as broadcasts.
    if(findMember(peer.id)){
      peer.send(JSON.stringify({type:'jukebox',state:jukeboxState(),myVote:jukeboxVoteOf(visitor.id)}))
      peer.send(JSON.stringify({type:'cat_taps',taps:catTaps()}))
    }
  },
  message(peer, message) {
    const p = findMember(peer.id)
    if (!p || !authorized(p)) { peer.send(JSON.stringify({type:'choose_avatar'}));leaveRoom(peer.id);peer.close();return }
    const now=Date.now(),rate=peer.context.rate as {at:number;count:number}|undefined
    if(!rate||now-rate.at>=1000)peer.context.rate={at:now,count:1}
    else if(++rate.count>40){leaveRoom(peer.id);peer.close(1008,'Message rate exceeded');return}
    if (message.text().length > 1000) return
    let data: { type?:string; text?:string; x?:number; y?:number; emoji?:string; trackId?:string; round?:number; name?:string; scene?:string; seat?:number }
    try { const parsed:unknown=JSON.parse(message.text());if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return;data=parsed } catch { return }
    if (data.type === 'move') {
      const x=data.x, y=data.y, now=Date.now()
      if (typeof x!=='number'||typeof y!=='number'||!onSceneFloor(p.scene,x,y)) return
      // A seated visitor's own late position update is not a reason to stand them up.
      if (p.pose==='sit'&&Math.hypot(x-p.x,y-p.y)<4) return
      if (now - p.lastMove < 65) return
      const maxDistance = Math.max(18,(now-p.lastMove)*0.24)
      if (Math.hypot(x-p.x,y-p.y) > maxDistance) return
      // Moving stands a seated visitor up; player_moved tells the scene so.
      if (p.pose!=='stand') { p.pose='stand'; p.seat=null }
      p.x=x; p.y=y; p.lastMove=now
      broadcastScene(p.scene,{type:'player_moved',id:p.id,x,y})
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
      // Chat stays one shared channel; the scene lets the log show where the speaker stands.
      publishChat({id:p.id,nickname:p.nickname,text,at:now,role:'visitor',scene:p.scene})
    } else if (data.type === 'emote') {
      if(!isChatEnabled()||isMuted(p.visitorId)){peer.send(JSON.stringify({type:'chat_blocked'}));return}
      if(typeof data.emoji!=='string')return
      const emoji=data.emoji
      const now=Date.now()
      if (!['👋','❤️','😂','✨'].includes(emoji) || now-p.lastChat<1000) return
      p.lastChat=now
      recordInteraction(p)
      broadcastScene(p.scene,{type:'emote',id:p.id,emoji})
    } else if (data.type==='jukebox_vote') {
      if(typeof data.trackId!=='string'||data.trackId.length>40)return
      const result=voteJukebox(p.visitorId,data.trackId,Number.isSafeInteger(data.round)?data.round:undefined)
      peer.send(JSON.stringify(result.ok?{type:'jukebox_vote_ok',round:result.round,trackId:result.trackId}:{type:'jukebox_vote_rejected',round:result.round,reason:result.reason}))
    } else if (data.type==='scene') {
      if(isScene(data.scene))changeScene(p,data.scene)
    } else if (data.type==='sit') {
      if(isSeat(data.seat))sitDown(p,data.seat);else peer.send(JSON.stringify({type:'sit_rejected'}))
    } else if (data.type==='stand') {
      standUp(p)
    } else if (data.type==='cat_tap') {
      if(isCatName(data.name))tapCat(p.visitorId,data.name)
    } else if (data.type==='ping') {
      // serverTime lets clients estimate their clock offset for music sync.
      peer.send(JSON.stringify({type:'pong',count:onlineCount(),serverTime:Date.now()}))
    }
  },
  close(peer) { leaveRoom(peer.id) },
  error(peer) { leaveRoom(peer.id) },
})
