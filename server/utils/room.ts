import { activeVisitor, getVisitor, publicOrder, type OrderRow } from './db'
import { randomUUID } from 'node:crypto'
import type { ChatMessage, AdminChatState } from '../../shared/chat'
import { benchSeats, scenes, SEAT_REACH, type Pose, type SceneId } from '../../shared/world'

type Connection = {
  id: string
  visitorId: number
  expiresAt: number
  nickname: string
  avatar: string
  // Which place the visitor stands in; position, pose, presence and emotes are scoped to it.
  scene: SceneId
  x: number
  y: number
  pose: Pose
  seat: number|null
  lastSceneChange: number
  lastMove: number
  lastChat: number
  chatWindowStart: number
  chatCount: number
  send: (payload: string) => void
  close: () => void
}
const members = new Map<string, Connection>()
let lastPruneAt=0
const interactions=new Map<number,{lastChat:number;chatWindowStart:number;chatCount:number}>()
const serialize = (x: unknown) => JSON.stringify(x)
let chatEnabled = true
const chatHistory:ChatMessage[]=[]
export function publishChat(message:Omit<ChatMessage,'messageId'>){
  const entry={...message,messageId:randomUUID()}
  chatHistory.push(entry)
  if(chatHistory.length>50)chatHistory.splice(0,chatHistory.length-50)
  broadcast({type:'chat',...entry})
}
export function adminChatState():AdminChatState{
  if(pruneExpired())broadcastPresence()
  return {messages:[...chatHistory],chatEnabled,online:members.size}
}
export function authorized(p:Connection){return Date.now()<p.expiresAt&&activeVisitor(getVisitor(p.visitorId))}
function pruneExpired(force=false){
  const now=Date.now()
  if(!force&&now-lastPruneAt<900)return false
  lastPruneAt=now
  let changed=false
  for(const p of members.values())if(!authorized(p)){
    members.delete(p.id);changed=true
    try{p.send(serialize({type:'choose_avatar'}));p.close()}catch{}
  }
  return changed
}
setInterval(()=>{
  if(pruneExpired())broadcastPresence()
  for(const [id,state] of interactions)if(Date.now()-Math.max(state.lastChat,state.chatWindowStart)>60_000)interactions.delete(id)
},1000).unref()
export function recordInteraction(p:Connection){interactions.set(p.visitorId,{lastChat:p.lastChat,chatWindowStart:p.chatWindowStart,chatCount:p.chatCount})}
// Without a scene: everyone connected. Visitors only ever receive the list for the scene they stand in.
export const playerList = (scene?:SceneId) => [...members.values()].filter(p=>!scene||p.scene===scene)
  .map(p => ({ id:p.id, nickname:p.nickname, avatar:p.avatar, x:p.x, y:p.y, pose:p.pose, ...(p.seat===null?{}:{seat:p.seat}) }))
export const onlineCount = () => members.size
const presence=(scene:SceneId)=>({type:'players',scene,players:playerList(scene),online:members.size})
function deliver(data:string,scene?:SceneId){
  for (const member of members.values()) {
    if(scene&&member.scene!==scene)continue
    try { member.send(data) } catch { members.delete(member.id) }
  }
}
export function broadcast(payload: object) {
  const removed=pruneExpired()
  deliver(serialize(payload))
  if(removed)broadcastPresence()
}
// Movement, emotes and poses only reach visitors standing in the same scene.
export function broadcastScene(scene:SceneId,payload:object){
  const removed=pruneExpired()
  deliver(serialize(payload),scene)
  if(removed)broadcastPresence()
}
// Each visitor gets the players in their own scene, plus the store-wide online count.
export function broadcastPresence(){
  const lists=new Map<SceneId,string>()
  for (const member of members.values()) {
    let data=lists.get(member.scene)
    if(!data){data=serialize(presence(member.scene));lists.set(member.scene,data)}
    try { member.send(data) } catch { members.delete(member.id) }
  }
}
export function findMember(id: string) { return members.get(id) }
export function joinRoom(p: Connection) {
  // One connected avatar per visitor session; an old tab is replaced on reconnect.
  pruneExpired(true)
  for (const old of members.values()) if (old.visitorId === p.visitorId) {
    members.delete(old.id);try{old.send(serialize({type:'replaced'}));old.close()}catch{}
  }
  if (members.size >= 40) { p.send(serialize({type:'room_full'})); p.close(); return }
  const previous=interactions.get(p.visitorId)
  if(previous)Object.assign(p,previous)
  members.set(p.id, p)
  p.send(serialize({ type:'welcome', selfId:p.id, scene:p.scene, players:playerList(p.scene), online:members.size, chatEnabled }))
  broadcastPresence()
}
export function leaveRoom(id: string) {
  if (!members.delete(id)) return
  broadcastPresence()
}
// Walking through a door: the visitor leaves one scene's presence and appears at the other scene's spawn.
// The same request twice is answered again (the client may have missed it); quick repeats are refused.
export function changeScene(p:Connection,scene:SceneId){
  const now=Date.now()
  if(now-p.lastSceneChange<800){p.send(serialize({type:'scene_rejected',scene:p.scene}));return false}
  p.scene=scene;p.lastSceneChange=now;p.x=scenes[scene].spawn.x;p.y=scenes[scene].spawn.y;p.lastMove=now;p.pose='stand';p.seat=null
  p.send(serialize({type:'scene_changed',scene,x:p.x,y:p.y,players:playerList(scene),online:members.size}))
  broadcastPresence()
  return true
}
// Sitting is only possible on a free bench seat the visitor is standing at.
export function sitDown(p:Connection,seat:number){
  const spot=benchSeats[seat]
  const taken=[...members.values()].some(other=>other.id!==p.id&&other.scene==='outside'&&other.pose==='sit'&&other.seat===seat)
  if(p.scene!=='outside'||!spot||taken||Math.hypot(p.x-spot.x,p.y-spot.y)>SEAT_REACH){p.send(serialize({type:'sit_rejected',seat}));return false}
  if(p.pose==='sit'&&p.seat===seat)return true
  p.x=spot.x;p.y=spot.y;p.pose='sit';p.seat=seat
  broadcastScene(p.scene,{type:'player_pose',id:p.id,pose:'sit',seat})
  return true
}
export function standUp(p:Connection){
  if(p.pose==='stand')return
  p.pose='stand';p.seat=null
  broadcastScene(p.scene,{type:'player_pose',id:p.id,pose:'stand'})
}
export function notifyOrderChanged(order: OrderRow) {
  broadcast({ type:'order_changed', order:publicOrder(order) })
}
export function publishMenuUpdated(menu:{date:string;version:string}){
  // The second event keeps already-open older visitors informed during a rolling deploy.
  broadcast({type:'menu:updated',date:menu.date,version:menu.version})
  broadcast({type:'menu_changed',date:menu.date,version:menu.version})
}
export function isChatEnabled() { return chatEnabled }
export function setChatEnabled(value: boolean) { chatEnabled = value; broadcast({type:'chat_enabled', enabled:value}) }
export function disconnectVisitor(id: string) {
  const member = members.get(id)
  if (!member) return
  member.send(serialize({type:'kicked'}))
  member.close()
  leaveRoom(id)
}
export function closeStoreRoom(){
  const leaving=[...members.values()]
  members.clear()
  for(const member of leaving){
    try{member.send(serialize({type:'store_closed'}))}catch{}
    try{member.close()}catch{}
  }
}
export function clearChatHistory(){
  chatHistory.length=0
  broadcast({type:'chat_reset'})
}
export function resetVisitorRoom(){
  const leaving=[...members.values()]
  members.clear()
  interactions.clear()
  mutedVisitorIds.clear()
  for(const member of leaving){
    try{member.send(serialize({type:'choose_avatar'}))}catch{}
    try{member.close()}catch{}
  }
}
const mutedVisitorIds = new Set<number>()
export function toggleMuteVisitor(id: number) {
  if (mutedVisitorIds.has(id)) mutedVisitorIds.delete(id)
  else mutedVisitorIds.add(id)
  return mutedVisitorIds.has(id)
}
export function isMuted(id: number) { return mutedVisitorIds.has(id) }
export function roomAdminState() {
  if(pruneExpired())broadcastPresence()
  return { chatEnabled, members:[...members.values()].map(p=>({id:p.id,visitorId:p.visitorId,nickname:p.nickname,scene:p.scene,muted:isMuted(p.visitorId)})) }
}
