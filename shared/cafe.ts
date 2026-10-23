// Kape & Chits: the 24/7 coffee tambayan next to the store. Every drink is virtual and free; nothing is ordered or paid.
// Shared by the barista dialog, the server's drink check and the Phaser cups.
export type DrinkId='iced-coffee'|'hot-latte'|'cappuccino'|'hot-chocolate'
export type Drink={id:DrinkId;label:string;line:string}
export const drinkOptions:readonly Drink[]=[
  {id:'iced-coffee',label:'Iced Coffee',line:'Malamig at matapang. Perfect!'},
  {id:'hot-latte',label:'Hot Latte',line:'Creamy, with a little heart on top.'},
  {id:'cappuccino',label:'Cappuccino',line:'Extra foam, just how you like it.'},
  {id:'hot-chocolate',label:'Hot Chocolate',line:'Tsokolate with marshmallows!'},
]
export function isDrink(value:unknown):value is DrinkId{return typeof value==='string'&&drinkOptions.some(drink=>drink.id===value)}
export const BARISTA_GREETING='Welcome sa Kape & Chits! Anong kape natin today?'

// Small animations a visitor can play for everyone in the café. Wave and laugh travel as the existing emotes.
export type CafeAction='sip'|'relax'
export function isCafeAction(value:unknown):value is CafeAction{return value==='sip'||value==='relax'}

// The chika board: friendly openers a visitor can drop into their chat box (never sent for them).
export const conversationStarters:readonly string[]=[
  'Kumusta araw mo?',
  'Team iced coffee or hot coffee?',
  'Anong ginagawa mo habang tumatambay?',
  "What's keeping you awake?",
  'Anong small win mo today?',
  'Anong favorite mong meryenda?',
  'Ulan o araw: which weather is best for kape?',
  'Any song recommendations for tonight?',
]

// The café jukebox: original music generated on each listener's device (see app/utils/cafeMusic.ts), from one shared
// timeline, so everyone in the café hears the same notes at the same moment. Each mood plays a set of a few minutes;
// visitors in the café vote for the next one, as with the store's jukebox. Listening and volume stay personal.
export type CafeMood='cafe'|'lofi'|'rain'
export const cafeMoods:readonly {id:CafeMood;label:string;note:string}[]=[
  {id:'cafe',label:'Relaxing Café',note:'Soft piano and warm chords'},
  {id:'lofi',label:'Lo-fi Chill',note:'Dusty beats, mellow keys'},
  {id:'rain',label:'Rainy Coffee Shop',note:'Rain on the window, quiet piano'},
]
export function isCafeMood(value:unknown):value is CafeMood{return cafeMoods.some(mood=>mood.id===value)}
export type CafeJukeboxState={mood:CafeMood;startedAt:number;endsAt:number;round:number;votes:Record<CafeMood,number>;upNext:CafeMood;serverNow:number}
export type CafeJukeboxVote={round:number;mood:CafeMood}|null
// Most votes wins, and the mood playing now can win again. Ties, and sets without votes, go to the mood that has
// waited longest, so with nobody voting the café cycles through all three. The same inputs always give the same mood.
export function chooseCafeMood(votes:Record<CafeMood,number>,lastPlayedAt:Partial<Record<CafeMood,number>>):CafeMood{
  const top=Math.max(...cafeMoods.map(mood=>votes[mood.id]))
  return cafeMoods.map(mood=>mood.id).filter(id=>votes[id]===top).sort((a,b)=>(lastPlayedAt[a]??-1)-(lastPlayedAt[b]??-1))[0]!
}
