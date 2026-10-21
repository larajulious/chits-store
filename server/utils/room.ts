import { activeVisitor, getVisitor, publicOrder, type OrderRow } from './db'
import { randomUUID } from 'node:crypto'
import type { ChatMessage, AdminChatState } from '../../shared/chat'
import { mascotSnapshot, releaseYarnOwner, startMascotUpdates } from './mascot'

type Connection = {
  id: string
  visitorId: number
  expiresAt: number
  nickname: string
  avatar: string
  x: number
  y: number
  lastMove: number
  lastChat: number
  chatWindowStart: number
  chatCount: number
  send: (payload: string) => void
  close: () => void
}
const members = new Map<string, Connection>()
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
  if(pruneExpired())broadcast({type:'players',players:playerList()})
  return {messages:[...chatHistory],chatEnabled,online:members.size}
}
export function authorized(p:Connection){return Date.now()<p.expiresAt&&activeVisitor(getVisitor(p.visitorId))}
function pruneExpired(){
  let changed=false
  for(const p of members.values())if(!authorized(p)){
    members.delete(p.id);releaseYarnOwner(p.id);changed=true
    try{p.send(serialize({type:'choose_avatar'}));p.close()}catch{}
  }
  return changed
}
setInterval(()=>{
  if(pruneExpired())broadcast({type:'players',players:playerList()})
  for(const [id,state] of interactions)if(Date.now()-Math.max(state.lastChat,state.chatWindowStart)>60_000)interactions.delete(id)
},1000).unref()
export function recordInteraction(p:Connection){interactions.set(p.visitorId,{lastChat:p.lastChat,chatWindowStart:p.chatWindowStart,chatCount:p.chatCount})}
export const playerList = () => [...members.values()].map(p => ({ id:p.id, nickname:p.nickname, avatar:p.avatar, x:p.x, y:p.y }))
export function broadcast(payload: object) {
  const removed=pruneExpired()
  const data = serialize(payload)
  const presence=removed?serialize({type:'players',players:playerList()}):undefined
  for (const member of members.values()) {
    try { member.send(data);if(presence)member.send(presence) } catch { members.delete(member.id);releaseYarnOwner(member.id) }
  }
}
export function findMember(id: string) { return members.get(id) }
export function joinRoom(p: Connection) {
  // One connected avatar per visitor session; an old tab is replaced on reconnect.
  pruneExpired()
  for (const old of members.values()) if (old.visitorId === p.visitorId) {
    members.delete(old.id);releaseYarnOwner(old.id);try{old.send(serialize({type:'replaced'}));old.close()}catch{}
  }
  if (members.size >= 40) { p.send(serialize({type:'room_full'})); p.close(); return }
  const previous=interactions.get(p.visitorId)
  if(previous)Object.assign(p,previous)
  members.set(p.id, p)
  p.send(serialize({ type:'welcome', selfId:p.id, players:playerList(), chatEnabled, mascot:mascotSnapshot() }))
  broadcast({ type:'players', players:playerList() })
}
export function leaveRoom(id: string) {
  if (!members.delete(id)) return
  releaseYarnOwner(id)
  broadcast({ type:'players', players:playerList() })
}
export function notifyOrderChanged(order: OrderRow) {
  broadcast({ type:'order_changed', order:publicOrder(order) })
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
    releaseYarnOwner(member.id)
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
    releaseYarnOwner(member.id)
    try{member.send(serialize({type:'choose_avatar'}))}catch{}
    try{member.close()}catch{}
  }
}
startMascotUpdates(()=>members.size>0,snapshot=>broadcast({type:'mascot',mascot:snapshot}))
const mutedVisitorIds = new Set<number>()
export function toggleMuteVisitor(id: number) {
  if (mutedVisitorIds.has(id)) mutedVisitorIds.delete(id)
  else mutedVisitorIds.add(id)
  return mutedVisitorIds.has(id)
}
export function isMuted(id: number) { return mutedVisitorIds.has(id) }
export function roomAdminState() {
  if(pruneExpired())broadcast({type:'players',players:playerList()})
  return { chatEnabled, members:[...members.values()].map(p=>({id:p.id,visitorId:p.visitorId,nickname:p.nickname,muted:isMuted(p.visitorId)})) }
}
