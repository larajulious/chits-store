// Shared jukebox shapes and the selection rules the server applies at the end of every track.
export const JUKEBOX_MAX_CANDIDATES=5

export type JukeboxTrack={id:string;title:string;mood:string;artist:string;durationMs:number;src:string}
export type JukeboxNowPlaying={track:JukeboxTrack;startedAt:number}
export type JukeboxState={
  enabled:boolean
  votingEnabled:boolean
  nowPlaying:JukeboxNowPlaying|null
  // Increments with every track, so a vote always belongs to one round.
  round:number
  candidates:JukeboxTrack[]
  votes:Record<string,number>
  upNext:string|null
  serverNow:number
}
export type JukeboxMyVote={round:number;trackId:string}|null
export type JukeboxLibraryEntry={id:string;title:string;mood:string;artist:string;file:string;license:string;durationMs:number|null;available:boolean;reason?:string;selected:boolean}
export type JukeboxAdminState={state:JukeboxState;library:JukeboxLibraryEntry[];libraryError?:string;totalVotes:number}

// The next tracks a visitor can vote for: everything except the current track, longest-waiting first.
export function votingCandidates(order:string[],current:string|null,lastPlayedAt:Record<string,number>){
  const others=order.filter(id=>id!==current)
  const pool=others.length?others:order
  return pool.map((id,index)=>({id,index,at:lastPlayedAt[id]??-1}))
    .sort((a,b)=>a.at-b.at||a.index-b.index).slice(0,JUKEBOX_MAX_CANDIDATES).map(entry=>entry.id)
}

// Most votes wins. Ties, and rounds without votes, go to the candidate that has waited longest,
// which is the first one in candidate order. The same inputs always give the same track.
export function chooseNextTrack(candidates:string[],votes:Iterable<string>):string|null{
  const counts=new Map(candidates.map(id=>[id,0]))
  for(const id of votes){const count=counts.get(id);if(count!==undefined)counts.set(id,count+1)}
  const top=Math.max(0,...counts.values())
  return candidates.find(id=>counts.get(id)===top)??null
}
