import type { OrderStatus } from './order-status'

export type CustomerOrderSummary={
  id:number
  number:string
  name:string|null
  status:OrderStatus
  visitor:string
  totalCentavos:number
  createdAt:number
  lastMessage:string|null
  unread:number
}
export type CustomerOrderDetail={
  order:{id:number;number:string;name:string|null;status:OrderStatus;totalCentavos:number;createdAt:number;serviceDate:string}
  items:{id:number;name:string;priceCentavos:number;quantity:number;lineTotalCentavos:number}[]
  messages:{id:number;role:'visitor'|'staff'|'system';text:string;at:number}[]
}
