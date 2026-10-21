export type CatMood='idle'|'walking'|'sitting'|'resting'|'sleeping'|'stretching'|'noticing_yarn'|'approaching_yarn'|'playing_with_yarn'|'returning_to_idle'
export type MascotSnapshot={cat:{x:number;y:number;mood:CatMood;facing:-1|1;purring:boolean};yarn:{x:number;y:number;held:boolean;moving:boolean}}

const obstacles=[{x:48,y:328,w:87,h:60},{x:228,y:365,w:86,h:58},{x:282,y:472,w:44,h:40}]
export function mascotFloorPoint(x:number,y:number,padding=0){
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<20+padding||x>340-padding||y<260+padding||y>542-padding)return false
  return !obstacles.some(box=>x>=box.x-padding&&x<=box.x+box.w+padding&&y>=box.y-padding&&y<=box.y+box.h+padding)
}
