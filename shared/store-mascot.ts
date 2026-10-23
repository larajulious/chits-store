// visiting / snuggling: Miming strolls over to Onay and the two sit together. They never fight.
export type CatMood='idle'|'walking'|'sitting'|'resting'|'sleeping'|'stretching'|'noticing_yarn'|'approaching_yarn'|'playing_with_yarn'|'returning_to_idle'|'visiting'|'snuggling'
export type CatName='Miming'|'Onay'
// The store-wide count of taps on each cat; it only ever goes up.
export type CatTaps=Record<CatName,number>
export type CatSnapshot={name:CatName;x:number;y:number;mood:CatMood;facing:-1|1;purring:boolean}
export type MascotSnapshot={cats:CatSnapshot[];yarn:{x:number;y:number;held:boolean;moving:boolean}}
// Miming roams the floor from beside the yarn. Onay stays put beside the feedback board,
// only sleeping or standing there.
export const residentCats:readonly {name:CatName;x:number;y:number;mood:CatMood;roams:boolean}[]=[
  {name:'Miming',x:232,y:466,mood:'sitting',roams:true},
  {name:'Onay',x:268,y:500,mood:'sleeping',roams:false},
]

// Floor footprints in world units: the feedback board, then the handyman's tile-repair corner.
export const storeObstacles=[{x:290,y:440,w:70,h:90},{x:36,y:366,w:116,h:58}]
const obstacles=storeObstacles
export function mascotFloorPoint(x:number,y:number,padding=0){
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<20+padding||x>340-padding||y<260+padding||y>542-padding)return false
  return !obstacles.some(box=>x>=box.x-padding&&x<=box.x+box.w+padding&&y>=box.y-padding&&y<=box.y+box.h+padding)
}
