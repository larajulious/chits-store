// Served remains the legacy key for Out for Delivery; completion is a separate step.
export const orderStatusLabels={Pending:'Pending confirmation',Preparing:'Preparing',Ready:'Ready',Served:'Out for Delivery',Delivered:'Delivered'} as const
export type OrderStatus=keyof typeof orderStatusLabels
export const orderNextStatus:Record<OrderStatus,OrderStatus|null>={Pending:'Preparing',Preparing:'Ready',Ready:'Served',Served:'Delivered',Delivered:null}
