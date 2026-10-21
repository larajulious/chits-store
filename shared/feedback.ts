export const FEEDBACK_VISIBLE_MS=10*60*60_000
export const FEEDBACK_MAX_LENGTH=500
export type FeedbackKind='suggestion'|'review'
export type FeedbackPost={id:number;kind:FeedbackKind;text:string;nickname:string;approvedAt:number;expiresAt:number}
export type FeedbackSubmission={id:number;kind:FeedbackKind;text:string;nickname:string;status:'pending'|'approved'|'rejected';createdAt:number;approvedAt:number|null;expiresAt:number|null}
export type PublicFeedbackState={posts:FeedbackPost[];now:number}
export type AdminFeedbackState={pending:FeedbackSubmission[];published:FeedbackSubmission[];pendingCount:number;now:number}
