import {createError} from 'h3'
import {db,type VisitorRow} from './db'
import {visitorName} from './auth'
import {FEEDBACK_MAX_LENGTH,FEEDBACK_VISIBLE_MS,type AdminFeedbackState,type FeedbackPost,type FeedbackSubmission} from '../../shared/feedback'

const hour=60*60_000
const attempts=new Map<string,{count:number;resetAt:number}>()
const fields='id,kind,text,nickname,status,created_at AS createdAt,approved_at AS approvedAt,expires_at AS expiresAt'
export function publicFeedback(now=Date.now()){
  const posts=db().prepare(`SELECT id,kind,text,nickname,approved_at AS approvedAt,expires_at AS expiresAt FROM feedback
    WHERE status='approved' AND expires_at>? ORDER BY approved_at DESC,id DESC LIMIT 50`).all(now) as FeedbackPost[]
  return {posts,now}
}
export function adminFeedback(now=Date.now()):AdminFeedbackState{
  return {
    pending:db().prepare(`SELECT ${fields} FROM feedback WHERE status='pending' ORDER BY created_at DESC,id DESC LIMIT 50`).all() as FeedbackSubmission[],
    published:db().prepare(`SELECT ${fields} FROM feedback WHERE status='approved' AND expires_at>? ORDER BY approved_at DESC,id DESC LIMIT 50`).all(now) as FeedbackSubmission[],
    pendingCount:(db().prepare("SELECT COUNT(*) AS total FROM feedback WHERE status='pending'").get() as {total:number}).total,
    now,
  }
}
export function submitFeedback(visitor:VisitorRow,body:{kind?:unknown;text?:unknown},address:string){
  if(!['suggestion','review'].includes(body.kind as string)||typeof body.text!=='string')throw createError({statusCode:400,statusMessage:'Choose Suggestion or Review and write your feedback'})
  const text=body.text.normalize('NFKC').replace(/[\p{C}]/gu,char=>char==='\n'?'\n':'').trim()
  if(!text||text.length>FEEDBACK_MAX_LENGTH)throw createError({statusCode:400,statusMessage:'Use 1–500 characters for your feedback'})
  const now=Date.now()
  for(const [key,entry] of attempts)if(entry.resetAt<=now)attempts.delete(key)
  const entry=attempts.get(address)||{count:0,resetAt:now+hour}
  if(entry.count>=10||(!attempts.has(address)&&attempts.size>=2048))throw createError({statusCode:429,statusMessage:'Too many submissions. Please try again later.'})
  const recent=db().prepare('SELECT COUNT(*) AS total,MAX(created_at) AS latest FROM feedback WHERE visitor_id=? AND created_at>?').get(visitor.id,now-hour) as {total:number;latest:number|null}
  if(recent.total>=3)throw createError({statusCode:429,statusMessage:'You can send up to three posts per hour. Please try again later.'})
  if(recent.latest!==null&&now-recent.latest<60_000)throw createError({statusCode:429,statusMessage:'Please wait one minute between feedback submissions.'})
  const result=db().prepare('INSERT INTO feedback(visitor_id,nickname,kind,text,created_at) VALUES(?,?,?,?,?)').run(visitor.id,visitorName(visitor),body.kind,text,now)
  entry.count++;attempts.set(address,entry)
  return {id:Number(result.lastInsertRowid),status:'pending' as const}
}
export function moderateFeedback(id:number,action:unknown){
  if(action!=='approve'&&action!=='reject')throw createError({statusCode:400,statusMessage:'Choose approve or reject'})
  const row=db().prepare('SELECT status,expires_at AS expiresAt FROM feedback WHERE id=?').get(id) as {status:string;expiresAt:number|null}|undefined
  if(!row)throw createError({statusCode:404,statusMessage:'Feedback not found'})
  if(action==='approve'){
    // Approval retries must never extend the original ten-hour visibility window.
    if(row.status==='approved')return
    if(row.status!=='pending')throw createError({statusCode:409,statusMessage:'Only pending feedback can be approved'})
    const now=Date.now()
    db().prepare("UPDATE feedback SET status='approved',approved_at=?,expires_at=? WHERE id=? AND status='pending'").run(now,now+FEEDBACK_VISIBLE_MS,id)
  }else{
    db().prepare("UPDATE feedback SET status='rejected' WHERE id=?").run(id)
  }
}
