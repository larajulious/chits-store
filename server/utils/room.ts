import { activeVisitor, getVisitor, publicOrder, type OrderRow } from './db'
import { randomUUID } from 'node:crypto'
import type { ChatMessage, AdminChatState } from '../../shared/chat'
import { arrivalSpot, sceneLinked, sceneSeats, SEAT_REACH, type Pose, type SceneId } from '../../shared/world'
import type { CafeAction, DrinkId } from '../../shared/cafe'
import { isStoreOpen } from './store'

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
  // The virtual café drink in hand; only ever held inside Kape & Chits.
  drink: DrinkId|null
  lastDrink: number
  lastAct: number
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
// Visitors who reported each message (by visitor ID, so one report each). Only staff see the counts.
const chatReports=new Map<string,Set<number>>()
const reportPace=new Map<number,{windowStart:number;count:number}>()
export function publishChat(message:Omit<ChatMessage,'messageId'>){
  const entry={...message,messageId:randomUUID()}
  chatHistory.push(entry)
  if(chatHistory.length>50)for(const old of chatHistory.splice(0,chatHistory.length-50))chatReports.delete(old.messageId)
  broadcast({type:'chat',...entry})
}
export function adminChatState():AdminChatState{
  if(pruneExpired())broadcastPresence()
  return {messages:chatHistory.map(message=>{const reports=chatReports.get(message.messageId)?.size;return reports?{...message,reports}:message}),chatEnabled,online:members.size}
}
// A visitor flags someone else's chat line for staff. Repeats are answered but never counted twice.
export function reportChat(p:Connection,messageId:string){
  const message=chatHistory.find(entry=>entry.messageId===messageId)
  if(!message||message.role!=='visitor'||message.id===p.id){p.send(serialize({type:'report_rejected',messageId}));return false}
  const now=Date.now(),pace=reportPace.get(p.visitorId)
  if(!pace||now-pace.windowStart>60_000)reportPace.set(p.visitorId,{windowStart:now,count:1})
  else if(++pace.count>10){p.send(serialize({type:'report_rejected',messageId,reason:'slow_down'}));return false}
  let reporters=chatReports.get(messageId)
  if(!reporters)chatReports.set(messageId,reporters=new Set())
  reporters.add(p.visitorId)
  p.send(serialize({type:'report_ok',messageId}))
  return true
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
  for(const [id,pace] of reportPace)if(Date.now()-pace.windowStart>60_000)reportPace.delete(id)
},1000).unref()
export function recordInteraction(p:Connection){interactions.set(p.visitorId,{lastChat:p.lastChat,chatWindowStart:p.chatWindowStart,chatCount:p.chatCount})}
// Without a scene: everyone connected. Visitors only ever receive the list for the scene they stand in.
export const playerList = (scene?:SceneId) => [...members.values()].filter(p=>!scene||p.scene===scene)
  .map(p => ({ id:p.id, nickname:p.nickname, avatar:p.avatar, x:p.x, y:p.y, pose:p.pose, ...(p.seat===null?{}:{seat:p.seat}), ...(p.drink?{drink:p.drink}:{}) }))
export const onlineCount = () => members.size
// The street also hears how many are in Kape & Chits (a count only, never who), for the sign by its door.
const cafeCount=()=>{let count=0;for(const member of members.values())if(member.scene==='cafe')count++;return count}
const presence=(scene:SceneId)=>({type:'players',scene,players:playerList(scene),online:members.size,...(scene==='outside'?{cafe:cafeCount()}:{})})
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
// Whether this visitor (any of their connections) is standing in the scene right now.
export function inScene(visitorId:number,scene:SceneId){for(const member of members.values())if(member.visitorId===visitorId)return member.scene===scene;return false}
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
  p.send(serialize({ type:'welcome', selfId:p.id, scene:p.scene, players:playerList(p.scene), online:members.size, chatEnabled, storeOpen:isStoreOpen() }))
  broadcastPresence()
}
export function leaveRoom(id: string) {
  if (!members.delete(id)) return
  broadcastPresence()
}
// Walking through a door: the visitor leaves one scene's presence and appears by the door in the other scene.
// Only neighbouring places connect (the store and the café each open onto the street).
// The same request twice is answered again (the client may have missed it); quick repeats are refused.
// While the store is closed its door is locked: visitors stay on the street. The café never closes.
export function changeScene(p:Connection,scene:SceneId){
  const now=Date.now()
  if(scene!==p.scene&&!sceneLinked(p.scene,scene)){p.send(serialize({type:'scene_rejected',scene:p.scene}));return false}
  if(scene==='store'&&!isStoreOpen()){p.send(serialize({type:'scene_rejected',scene:p.scene,reason:'closed'}));return false}
  if(now-p.lastSceneChange<800){p.send(serialize({type:'scene_rejected',scene:p.scene}));return false}
  placeInScene(p,scene,now)
  broadcastPresence()
  return true
}
function placeInScene(p:Connection,scene:SceneId,now:number){
  const spot=arrivalSpot(scene,p.scene)
  // Seats and drinks stay behind: a visitor always arrives standing, empty-handed.
  p.scene=scene;p.lastSceneChange=now;p.x=spot.x;p.y=spot.y;p.lastMove=now;p.pose='stand';p.seat=null;p.drink=null
  p.send(serialize({type:'scene_changed',scene,x:p.x,y:p.y,players:playerList(scene),online:members.size}))
}
// Sitting is only possible on a free seat in the visitor's own scene that they are standing at.
export function sitDown(p:Connection,seat:number){
  const spot=sceneSeats[p.scene][seat]
  const taken=[...members.values()].some(other=>other.id!==p.id&&other.scene===p.scene&&other.pose==='sit'&&other.seat===seat)
  if(!spot||taken||Math.hypot(p.x-spot.x,p.y-spot.y)>SEAT_REACH){p.send(serialize({type:'sit_rejected',seat}));return false}
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
// The barista hands over a free virtual drink; everyone in the café sees the cup. Ordering again swaps it.
export function takeDrink(p:Connection,drink:DrinkId){
  const now=Date.now()
  if(p.scene!=='cafe'||now-p.lastDrink<1500||p.drink===drink)return false
  p.drink=drink;p.lastDrink=now
  broadcastScene(p.scene,{type:'player_drink',id:p.id,drink})
  return true
}
// Sipping (with a drink in hand) and relaxing are short animations everyone in the café sees.
export function playAction(p:Connection,action:CafeAction){
  const now=Date.now()
  if(p.scene!=='cafe'||now-p.lastAct<800||(action==='sip'&&!p.drink))return false
  p.lastAct=now
  broadcastScene(p.scene,{type:'player_act',id:p.id,action})
  return true
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
// Closing the store shows everyone the street: visitors inside are walked out to the pavement, nobody is disconnected.
export function closeStoreRoom(){
  const now=Date.now()
  for(const member of members.values())if(member.scene==='store'){try{placeInScene(member,'outside',now)}catch{members.delete(member.id)}}
  broadcast({type:'store_status',open:false})
  broadcastPresence()
}
export function reopenStoreRoom(){broadcast({type:'store_status',open:true})}
export function clearChatHistory(){
  chatHistory.length=0
  chatReports.clear()
  broadcast({type:'chat_reset'})
}
export function resetVisitorRoom(){
  const leaving=[...members.values()]
  members.clear()
  interactions.clear()
  reportPace.clear()
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
