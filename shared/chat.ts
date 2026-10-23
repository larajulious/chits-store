import type { SceneId } from './world'

export type ChatMessage={
  messageId:string
  id:string
  nickname:string
  text:string
  at:number
  role:'visitor'|'staff'
  // Where a visitor was standing when they spoke; staff messages have none.
  scene?:SceneId
  // Staff view only: how many visitors reported this line.
  reports?:number
}
export type AdminChatState={messages:ChatMessage[];chatEnabled:boolean;online:number}
