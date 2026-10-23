// The connected places a visitor can stand in. The server validates every move against the scene's floor,
// so keep these numbers in step with the walkable areas the Phaser scenes draw.
export type SceneId='store'|'outside'|'cafe'
export type Pose='stand'|'sit'
type Point={x:number;y:number}
type SceneInfo={label:string;width:number;height:number;floor:{minX:number;maxX:number;minY:number;maxY:number};spawn:Point}
export const scenes:Record<SceneId,SceneInfo>={
  // Spawn just inside the entrance, so a visitor coming back from the street appears by the door.
  store:{label:'Inside',width:360,height:580,floor:{minX:20,maxX:340,minY:260,maxY:542},spawn:{x:180,y:510}},
  // Two screens wide; the camera follows the visitor along the street. Spawn on the pavement outside the store door.
  outside:{label:'Outside',width:720,height:580,floor:{minX:20,maxX:700,minY:266,maxY:530},spawn:{x:360,y:300}},
  // Kape & Chits, the 24/7 coffee tambayan next door: a room the size of the store (x 0..360), then a doorway onto
  // the open-air Tanaw Deck beside it (x 360..720). The camera follows the visitor between the two.
  cafe:{label:'Kape & Chits',width:720,height:580,floor:{minX:20,maxX:700,minY:260,maxY:542},spawn:{x:180,y:510}},
}
// Which doors connect which places: the store and the café both open onto the street.
const links:Record<SceneId,readonly SceneId[]>={store:['outside'],outside:['store','cafe'],cafe:['outside']}
export function sceneLinked(from:SceneId,to:SceneId){return links[from].includes(to)}
// Where a visitor appears after walking through a door: on the street, in front of the door they came out of.
export function arrivalSpot(scene:SceneId,from?:SceneId):Point{
  if(scene==='outside'&&from==='cafe')return {x:600,y:300}
  return scenes[scene].spawn
}
// The view is always 580 world units tall. Its width follows the stage's shape, so the game fills the screen
// edge to edge: 360 on a phone, wider on tablets and laptops (each scene draws scenery past its edges), capped
// for ultra-wide screens. Widths are whole art pixels (2 world units).
export const VIEW_H=580,MIN_VIEW_W=360,MAX_VIEW_W=1800
export function viewWidthFor(width:number,height:number){
  if(!(width>0&&height>0))return MIN_VIEW_W
  return Math.max(MIN_VIEW_W,Math.min(MAX_VIEW_W,Math.round(width/height*VIEW_H/2)*2))
}
export function isScene(value:unknown):value is SceneId{return value==='store'||value==='outside'||value==='cafe'}
export function onSceneFloor(scene:SceneId,x:number,y:number){
  const {minX,maxX,minY,maxY}=scenes[scene].floor
  return Number.isFinite(x)&&Number.isFinite(y)&&x>=minX&&x<=maxX&&y>=minY&&y<=maxY
}

// The bench in front of the sari-sari store seats two. A visitor sits from the floor spot in front of a seat;
// that spot stays their network position, and the scene draws them up on the seat.
export const benchSeats:readonly Point[]=[{x:100,y:300},{x:140,y:300}]
// Kape & Chits, inside: two chairs behind each of three tables (0-5), then the two sofa seats in the lounge corner (6, 7).
// On the deck: two benches facing the view (8-11), a table for two (12, 13), and five spots to lean on the railing
// (14-18), which are seats too, so only one visitor leans at each.
// Grid points (multiples of 20) so a walk ends exactly on the seat.
export const cafeSeats:readonly Point[]=[{x:80,y:360},{x:120,y:360},{x:80,y:460},{x:120,y:460},{x:220,y:400},{x:260,y:400},{x:260,y:280},{x:300,y:280},
  {x:440,y:400},{x:480,y:400},{x:600,y:400},{x:640,y:400},{x:520,y:500},{x:560,y:500},
  {x:420,y:300},{x:480,y:300},{x:540,y:300},{x:600,y:300},{x:660,y:300}]
export const sceneSeats:Record<SceneId,readonly Point[]>={store:[],outside:benchSeats,cafe:cafeSeats}
// How far from the seat's floor spot a sit request is still believed (moves are sent about every 90 ms).
export const SEAT_REACH=40
export function isSeat(value:unknown,scene:SceneId='outside'):value is number{return Number.isInteger(value)&&(value as number)>=0&&(value as number)<sceneSeats[scene].length}

// Just-for-fun vending machine drinks. Add a product here to stock it; 'soon' slots show as reserved.
export type VendingProduct={id:string;label:string;can:string;band:string;soon?:boolean}
export const vendingProducts:readonly VendingProduct[]=[
  {id:'buko',label:'Buko juice',can:'#f4f0d8',band:'#79945b'},
  {id:'calamansi',label:'Calamansi',can:'#c6e07a',band:'#5c9a4a'},
  {id:'gulaman',label:"Sago't gulaman",can:'#c88b4d',band:'#5e3d27'},
  {id:'mango',label:'Mango shake',can:'#f6c445',band:'#e8843c'},
  {id:'choco',label:'Choco milk',can:'#8a5c3a',band:'#fff1cf'},
  {id:'ube',label:'Ube latte',can:'#b28ac5',band:'#fff1cf',soon:true},
]
