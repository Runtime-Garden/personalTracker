import {pool,tx,one,id} from './db.js';
import {withinQuietHours} from './quiet-hours.js';
interface EmailJob {notification_id:string;user_id:string;attempts:number;email:string;message:string;timezone:string;quiet_start:string|null;quiet_end:string|null}
async function claim():Promise<EmailJob|null>{return tx(async c=>{
 const item=await one<EmailJob>(`SELECT q.notification_id,q.user_id,q.attempts,u.email,n.message,u.timezone,
 p.quiet_start::text,p.quiet_end::text FROM notification_email_outbox q
 JOIN users u ON u.id=q.user_id JOIN notifications n ON n.id=q.notification_id
 LEFT JOIN notification_preferences p ON p.user_id=u.id
 WHERE q.attempts<5 AND q.next_attempt_at<=now() AND
 ((q.state IN ('pending','failed')) OR (q.state='sending' AND q.leased_at<now()-interval '10 minutes'))
 AND u.disabled=false AND u.email_verified_at IS NOT NULL
 ORDER BY q.next_attempt_at FOR UPDATE OF q SKIP LOCKED LIMIT 1`,[],c);
 if(!item)return null;
 await c.query(`UPDATE notification_email_outbox SET state='sending',attempts=attempts+1,leased_at=now() WHERE notification_id=$1`,[item.notification_id]);return item;
});}
export async function deliverEmailBatch(limit=10):Promise<{delivered:number;delayed:number;failed:number}>{
 if(!process.env.RESEND_API_KEY||!process.env.MAIL_FROM)return {delivered:0,delayed:0,failed:0};
 const result={delivered:0,delayed:0,failed:0};
 for(let i=0;i<Math.min(limit,20);i++){
  const item=await claim();if(!item)break;
  if(withinQuietHours(new Date(),item.timezone,item.quiet_start,item.quiet_end)){
   await pool.query("UPDATE notification_email_outbox SET state='pending',next_attempt_at=now()+interval '30 minutes',leased_at=NULL WHERE notification_id=$1",[item.notification_id]);result.delayed++;continue;
  }
  try{
   const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${process.env.RESEND_API_KEY}`,'content-type':'application/json'},body:JSON.stringify({from:process.env.MAIL_FROM,to:[item.email],subject:'Personal Tracker notification',text:`${item.message}\n\nOpen your Personal Tracker to review the details.\n${process.env.APP_URL||''}`}),signal:AbortSignal.timeout(10000),redirect:'error'});
   if(!response.ok)throw Error(`Email provider HTTP ${response.status}`);
   await pool.query("UPDATE notification_email_outbox SET state='delivered',delivered_at=now(),leased_at=NULL,last_error=NULL WHERE notification_id=$1",[item.notification_id]);result.delivered++;
  }catch{
   // Do not write recipient, provider body, or token to logs.
   const minutes=Math.min(120,Math.pow(2,item.attempts+1));
   await pool.query("UPDATE notification_email_outbox SET state='failed',leased_at=NULL,next_attempt_at=now()+make_interval(mins=>$2),last_error='Delivery attempt failed' WHERE notification_id=$1",[item.notification_id,minutes]);
   if(item.attempts>=4)await pool.query("INSERT INTO system_alerts(id,severity,event,details) VALUES($1,'warning','email.delivery.exhausted',$2)",[id(),JSON.stringify({notification_id:item.notification_id})]);result.failed++;
  }
 }
 return result;
}
