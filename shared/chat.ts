export type ChatMessage={
  messageId:string
  id:string
  nickname:string
  text:string
  at:number
  role:'visitor'|'staff'
}
export type AdminChatState={messages:ChatMessage[];chatEnabled:boolean;online:number}
