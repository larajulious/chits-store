import { defineWebSocketHandler } from 'h3'
import { allowedOrigin, visitorSessionFromCookie, visitorName } from '../utils/auth'
import { joinRoom, leaveRoom, findMember, broadcastScene, publishChat, onlineCount, isChatEnabled, isMuted, authorized, recordInteraction, changeScene, sitDown, standUp, takeDrink, trashDrink, playAction, reportChat } from '../utils/room'
import { isScene, isSeat, onSceneFloor, scenes, type SceneId } from '../../shared/world'
import {isStoreOpen} from '../utils/store'
import {jukeboxState, jukeboxVoteOf, voteJukebox} from '../utils/jukebox'
import {catTaps, isCatName, tapCat} from '../utils/cat-taps'
import {isCafeAction, isCafeMood, isHeldDrink} from '../../shared/cafe'
import {cafeJukeboxState, cafeMood, cafeVoteOf, voteCafeMood} from '../utils/cafeJukebox'

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
    // While the store is closed, anyone headed inside lands on the street; the café stays open around the clock.
    let scene:SceneId='store'
    try{const wanted=new URL(request?.url||'/ws','http://localhost').searchParams.get('scene');if(isScene(wanted))scene=wanted}catch{}
    if(scene==='store'&&!isStoreOpen())scene='outside'
    // A refresh mid-ride gets off the jeepney: it drops the visitor in front of the store.
    if(scene==='jeepney')scene='outside'
    const {x,y}=scenes[scene].spawn
    joinRoom({ id:peer.id, visitorId:visitor.id, expiresAt:session!.expiresAt, nickname:visitorName(visitor), avatar:visitor.avatar_key,
      scene, x, y, pose:'stand', seat:null, drink:null, lastDrink:0, lastAct:0, lastSceneChange:0, lastMove:Date.now(), lastChat:0, chatWindowStart:Date.now(), chatCount:0,
      send:payload => peer.send(payload), close:()=>peer.close() })
    // Late joiners and reconnects get the shared timeline once; later changes arrive as broadcasts.
    if(findMember(peer.id)){
      peer.send(JSON.stringify({type:'jukebox',state:jukeboxState(),myVote:jukeboxVoteOf(visitor.id)}))
      peer.send(JSON.stringify({type:'cat_taps',taps:catTaps()}))
      sendCafeMusic(peer,visitor.id,scene)
    }
  },
  message(peer, message) {
    const p = findMember(peer.id)
    if (!p || !authorized(p)) { peer.send(JSON.stringify({type:'choose_avatar'}));leaveRoom(peer.id);peer.close();return }
    const now=Date.now(),rate=peer.context.rate as {at:number;count:number}|undefined
    if(!rate||now-rate.at>=1000)peer.context.rate={at:now,count:1}
    else if(++rate.count>40){leaveRoom(peer.id);peer.close(1008,'Message rate exceeded');return}
    if (message.text().length > 1000) return
    let data: { type?:string; text?:string; x?:number; y?:number; emoji?:string; trackId?:string; round?:number; name?:string; scene?:string; seat?:number; drink?:string; action?:string; messageId?:string; mood?:string }
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
      // The same line again within half a minute is spam, not conversation.
      const repeat=peer.context.lastChat as {text:string;at:number}|undefined
      if (repeat && repeat.text.toLowerCase()===text.toLowerCase() && now-repeat.at<30_000) { peer.send(JSON.stringify({type:'chat_repeat'})); return }
      if (now-p.chatWindowStart>60_000) { p.chatWindowStart=now; p.chatCount=0 }
      ++p.chatCount;recordInteraction(p)
      if (p.chatCount>20) { peer.send(JSON.stringify({type:'chat_slow_down'})); return }
      p.lastChat=now;peer.context.lastChat={text,at:now}
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
      // Walking into the café tunes in to its music timeline, and onto the street to its weather; changes arrive as broadcasts.
      if(isScene(data.scene)&&changeScene(p,data.scene))sendCafeMusic(peer,p.visitorId,p.scene)
    } else if (data.type==='sit') {
      if(isSeat(data.seat,p.scene))sitDown(p,data.seat);else peer.send(JSON.stringify({type:'sit_rejected'}))
    } else if (data.type==='stand') {
      standUp(p)
    } else if (data.type==='drink') {
      if(isHeldDrink(data.drink))takeDrink(p,data.drink)
    } else if (data.type==='trash') {
      trashDrink(p)
    } else if (data.type==='act') {
      if(isCafeAction(data.action))playAction(p,data.action)
    } else if (data.type==='report') {
      if(typeof data.messageId==='string'&&data.messageId.length<=64)reportChat(p,data.messageId)
    } else if (data.type==='cafe_vote') {
      if(!isCafeMood(data.mood))return
      const result=voteCafeMood(p.visitorId,data.mood,typeof data.round==='number'?data.round:undefined)
      peer.send(JSON.stringify(result.ok?{type:'cafe_vote_ok',round:result.round,mood:result.mood}:{type:'cafe_vote_rejected',round:result.round,reason:result.reason}))
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
// The café hears its whole music timeline, and so do jeepney riders (the café's music plays on the ride); the street
// only its mood, which is the weather (rain for the rainy mood).
function sendCafeMusic(peer:{send:(data:string)=>void},visitorId:number,scene:SceneId){
  if(scene==='cafe'||scene==='jeepney')peer.send(JSON.stringify({type:'cafe_jukebox',state:cafeJukeboxState(),myVote:cafeVoteOf(visitorId)}))
  else if(scene==='outside')peer.send(JSON.stringify({type:'cafe_mood',mood:cafeMood()}))
}
