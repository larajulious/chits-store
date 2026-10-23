// A visitor's chosen name, checked the same way by the forms and the server. Everyone is shown as "Name #012":
// the visitor number keeps names unique (nobody can pass as another visitor) and is what a chat mute holds on to.
// An empty name means the default, the food buddy's name.
export const NICKNAME_MIN=2,NICKNAME_MAX=16
export type NicknameCheck={ok:true;nickname:string}|{ok:false;reason:string}

// Names that would look official, matched anywhere in the letters ("Chits_Staff" too).
const RESERVED=['staff','admin','moderator','barista','chitsstore','official','system']
// Insults and slurs, English and Filipino. Long, distinctive ones are matched anywhere in the letters; short ones only
// as a whole word, so ordinary names that happen to contain them still pass. Staff can still mute or remove anyone.
const BLOCKED_ANYWHERE=['fuck','bitch','nigger','nigga','faggot','putangina','tangina','tarantado','kantot','pokpok','hindot']
const BLOCKED_WORDS=['shit','cunt','fag','rape','puta','gago','gaga','ulol','bobo','tanga','puke','titi','burat','pekpek','jakol']

export function checkNickname(value:unknown):NicknameCheck{
  if(typeof value!=='string')return {ok:false,reason:'Type a name.'}
  const nickname=value.normalize('NFKC').replace(/[\p{C}]/gu,'').replace(/\s+/gu,' ').trim()
  if(!nickname)return {ok:true,nickname:''}
  const length=[...nickname].length
  if(length<NICKNAME_MIN||length>NICKNAME_MAX)return {ok:false,reason:`Use ${NICKNAME_MIN} to ${NICKNAME_MAX} characters.`}
  if(!/^[\p{L}\p{M}\p{N} ._'-]+$/u.test(nickname))return {ok:false,reason:"Use letters, numbers, spaces and . _ - ' only."}
  if(!/\p{L}/u.test(nickname))return {ok:false,reason:'Include at least one letter.'}
  const lower=nickname.toLowerCase(),letters=lower.replace(/[^\p{L}]/gu,''),words=lower.split(/[^\p{L}]+/u)
  if(RESERVED.some(word=>letters.includes(word)))return {ok:false,reason:'That name is reserved. Try another.'}
  if(BLOCKED_ANYWHERE.some(word=>letters.includes(word))||words.some(word=>BLOCKED_WORDS.includes(word)))return {ok:false,reason:'Please choose a kinder name.'}
  return {ok:true,nickname}
}
