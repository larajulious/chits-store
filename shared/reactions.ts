// Integer-grid artwork shared by the UI and Phaser. Emoji remain the wire values.
type PixelRect=readonly [x:number,y:number,width:number,height:number,color:number]
const gold=0xe9b84f,light=0xffdd79,brown=0x805134,red=0xd76a65
export const reactionOptions:readonly {id:string;emoji:string;label:string;pixels:readonly PixelRect[]}[]=[
  {id:'wave',emoji:'👋',label:'Wave',pixels:[
    [6,1,2,8,brown],[9,2,2,7,brown],[3,3,2,7,brown],[12,5,2,7,brown],[1,8,2,4,brown],[3,10,11,4,brown],[5,14,7,2,brown],
    [6,2,1,8,light],[9,3,1,7,light],[3,4,1,7,light],[12,6,1,6,light],[2,9,1,3,light],[4,10,8,4,gold],[6,14,5,1,gold],[5,9,5,3,light],
    [0,2,1,3,gold],[1,1,2,1,gold],[13,1,2,1,gold],[15,2,1,3,gold],
  ]},
  {id:'love',emoji:'❤️',label:'Love',pixels:[
    [2,2,4,1,brown],[10,2,4,1,brown],[1,3,6,2,brown],[9,3,6,2,brown],[0,5,16,5,brown],[2,10,12,2,brown],[4,12,8,2,brown],[6,14,4,1,brown],
    [2,3,4,2,red],[10,3,4,2,red],[1,5,14,4,red],[3,9,10,2,red],[5,11,6,2,red],[7,13,2,1,red],
    [3,4,2,1,0xffaba0],[2,5,1,3,0xffaba0],[12,6,2,3,0xb94c53],[10,9,2,2,0xb94c53],
  ]},
  {id:'laugh',emoji:'😂',label:'Laugh',pixels:[
    [4,1,8,1,brown],[2,2,12,2,brown],[1,4,14,8,brown],[2,12,12,2,brown],[4,14,8,1,brown],
    [4,2,8,1,light],[2,4,12,8,gold],[4,3,8,10,gold],[4,13,8,1,gold],
    [3,5,2,1,brown],[5,6,2,1,brown],[9,6,2,1,brown],[11,5,2,1,brown],
    [4,9,8,2,brown],[5,11,6,2,brown],[6,12,4,1,red],
    [1,8,2,5,0x6eabb3],[13,8,2,5,0x6eabb3],[0,10,2,2,0xa5d5db],[14,10,2,2,0xa5d5db],
  ]},
  {id:'sparkle',emoji:'✨',label:'Sparkle',pixels:[
    [7,0,2,4,brown],[5,4,6,2,brown],[3,6,10,3,brown],[5,9,6,2,brown],[7,11,2,4,brown],
    [7,2,2,4,light],[5,6,6,3,gold],[7,9,2,4,light],[4,7,8,1,light],
    [1,1,1,5,gold],[0,3,3,1,gold],[13,11,1,5,gold],[11,13,5,1,gold],
  ]},
]
