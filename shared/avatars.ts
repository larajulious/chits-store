// Shared by the picker, visitor validation/names, and Phaser textures.
// Keep existing IDs stable so saved visitor sessions continue to work.
export const avatarOptions = [
  {id:'mochi',label:'Mochi',body:0xffeed3,detail:0xeabb8c},
  {id:'maja',label:'Maja',body:0xf4d17c,detail:0xdca04e},
  {id:'boba',label:'Boba',body:0xb38b6f,detail:0x7b5243},
  {id:'cupcake',label:'Cupcake',body:0xf4a8b1,detail:0xd87491},
  {id:'palitaw',label:'Palitaw',body:0xfff6e5,detail:0xd8c4a0},
  {id:'biko',label:'Biko',body:0xc88b4d,detail:0x83502e},
  {id:'puto',label:'Puto',body:0xfff6dc,detail:0xf0c34f},
  {id:'kutsinta',label:'Kutsinta',body:0xc77836,detail:0x8e4829},
  {id:'suman',label:'Suman',body:0x89a665,detail:0x4f754c},
  {id:'sapin-sapin',label:'Sapin-sapin',body:0xb28ac5,detail:0xe6bd62},
  {id:'bibingka',label:'Bibingka',body:0xe4b95b,detail:0x79945b},
  {id:'pichi-pichi',label:'Pichi-pichi',body:0xf5e6ad,detail:0xfff9e8},
] as const

export type AvatarId = typeof avatarOptions[number]['id']
export function isAvatar(value:unknown):value is AvatarId {
  return typeof value==='string' && avatarOptions.some(avatar=>avatar.id===value)
}
