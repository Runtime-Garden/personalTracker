import type {FastifyInstance,FastifyRequest} from 'fastify';
import {createHash} from 'node:crypto';
import {sniffAttachment,safeAttachmentName} from './file-kind.js';
import {mkdir,writeFile,readFile,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {pool,rows,one,id,assert,named,audit,checkInstant,HttpError} from './db.js';
import {membership,type User} from './auth.js';
const body=(r:FastifyRequest)=>r.body as Record<string,any>||{};
const params=(r:FastifyRequest)=>r.params as {wid:string;id:string;tid:string};
const STORAGE=process.env.ATTACHMENTS_DIR||'/app/uploads';
const LIMIT=5*1024*1024;
export function validZone(v:unknown):string{
 assert(typeof v==='string'&&v.length<=80,'Invalid timezone');
 try{new Intl.DateTimeFormat('en',{timeZone:v});}catch{throw new HttpError(400,'Invalid timezone');}
 return v;
}
export function registerAdvanced(app:FastifyInstance,auth:(r:FastifyRequest)=>User){
 // Raw upload, deliberately without arbitrary multipart fields or user-defined filesystem paths.
 app.addContentTypeParser('application/octet-stream',{parseAs:'buffer',bodyLimit:LIMIT},(_req,b,done)=>done(null,b));
 const scoped=async(r:FastifyRequest,role:'viewer'|'member'|'admin'='viewer')=>{const u=auth(r),wid=params(r).wid;await membership(u.id,wid,role);return {u,wid};};
 const task=async(wid:string,tid:string)=>{const t=await one('SELECT id FROM tasks WHERE workspace_id=$1 AND id=$2 AND archived=false',[wid,tid]);assert(t,'Task missing',404);};
 app.get('/api/workspaces/:wid/tasks/:tid/attachments',async r=>{const {wid}=await scoped(r);await task(wid,params(r).tid);return rows('SELECT id,original_name,media_type,byte_size,created_at,uploader_id FROM task_attachments WHERE workspace_id=$1 AND task_id=$2 ORDER BY created_at DESC',[wid,params(r).tid]);});
 app.post('/api/workspaces/:wid/tasks/:tid/attachments',{bodyLimit:LIMIT},async r=>{
   const {u,wid}=await scoped(r,'member'),tid=params(r).tid;
   await task(wid,tid);
   const buf=r.body as Buffer;assert(Buffer.isBuffer(buf)&&buf.length>0&&buf.length<=LIMIT,'Invalid upload size',400);
   const fileType=sniffAttachment(buf);assert(fileType,'Unsupported file type',415);
   let filename='';try{filename=decodeURIComponent(String(r.headers['x-file-name']||''));}catch{throw new HttpError(400,'Invalid filename encoding');}
   filename=named(filename,'filename',200);assert(safeAttachmentName(filename),'Unsafe filename');
   await mkdir(STORAGE,{recursive:true,mode:0o700});
   const aid=id(),key=id(),digest=createHash('sha256').update(buf).digest('hex');
   await writeFile(join(STORAGE,key),buf,{flag:'wx',mode:0o600});
   try{await pool.query(`INSERT INTO task_attachments(id,workspace_id,task_id,uploader_id,original_name,storage_key,media_type,byte_size,sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[aid,wid,tid,u.id,filename,key,fileType,buf.length,digest]);}
   catch(e){await unlink(join(STORAGE,key)).catch(()=>{});throw e;}
   await audit(u.id,wid,'attachment.created',aid,{task_id:tid,size:buf.length});return {id:aid,name:filename,byte_size:buf.length};
 });
 app.get('/api/workspaces/:wid/attachments/:id/download',async(r,reply)=>{
   const {wid}=await scoped(r),file=await one<{storage_key:string;original_name:string;media_type:string;sha256:string;byte_size:number}>(`SELECT a.storage_key,a.original_name,a.media_type,a.sha256,a.byte_size FROM task_attachments a JOIN tasks t ON t.id=a.task_id AND t.workspace_id=a.workspace_id WHERE a.id=$1 AND a.workspace_id=$2 AND t.archived=false`,[params(r).id,wid]);
   assert(file,'Attachment not found',404);
   const buf=await readFile(join(STORAGE,file.storage_key)).catch(()=>{throw new HttpError(503,'Attachment file is unavailable');});assert(buf.length===file.byte_size&&createHash('sha256').update(buf).digest('hex')===file.sha256,'Attachment integrity check failed',503);
   reply.header('Content-Type','application/octet-stream').header('Cache-Control','private, no-store').header('X-Content-Type-Options','nosniff').header('Content-Disposition',`attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(file.original_name)}`);
   return reply.send(buf);
 });
 app.delete('/api/workspaces/:wid/attachments/:id',async r=>{const {wid,u}=await scoped(r,'member');const record=await one<{storage_key:string;uploader_id:string}>(`SELECT a.storage_key,a.uploader_id FROM task_attachments a JOIN tasks t ON t.id=a.task_id AND t.workspace_id=a.workspace_id WHERE a.id=$1 AND a.workspace_id=$2 AND t.archived=false`,[params(r).id,wid]);assert(record,'Attachment not found',404);const m=await membership(u.id,wid);assert(record.uploader_id===u.id||['owner','admin'].includes(m.role),'Uploader or workspace admin required',403);await pool.query('DELETE FROM task_attachments WHERE id=$1 AND workspace_id=$2',[params(r).id,wid]);await unlink(join(STORAGE,record.storage_key)).catch(()=>{});await audit(u.id,wid,'attachment.deleted',params(r).id);return {ok:true};});
 app.post('/api/workspaces/:wid/tasks/:tid/mentions',async r=>{const {wid,u}=await scoped(r,'member'),tid=params(r).tid,uid=named(body(r).user_id,'member ID',60);await task(wid,tid);const person=await one('SELECT user_id FROM members WHERE workspace_id=$1 AND user_id=$2',[wid,uid]);assert(person,'Mention target must be workspace member',403);const created=await pool.query('INSERT INTO task_mentions(task_id,user_id,actor_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[tid,uid,u.id]);if(!created.rowCount)return {ok:true,already_mentioned:true};await pool.query(`INSERT INTO notifications(id,user_id,workspace_id,message) VALUES($1,$2,$3,$4)`,[id(),uid,wid,`${u.name} mentioned you in a task`]);await audit(u.id,wid,'task.mentioned',tid,{user_id:uid});return {ok:true};});
 app.get('/api/workspaces/:wid/sprints/:id/analytics',async r=>{const {wid}=await scoped(r),sid=params(r).id;const sprint=await one<{id:string;start_date:string;end_date:string;name:string}>(`SELECT s.id,s.name,s.start_date,s.end_date FROM sprints s JOIN projects p ON p.id=s.project_id WHERE p.workspace_id=$1 AND s.id=$2`,[wid,sid]);assert(sprint,'Sprint missing',404);const [totals,snapshots,velocity]=await Promise.all([
 one(`SELECT count(*)::int total,count(*) FILTER(WHERE t.status='done')::int done,COALESCE(sum(t.estimate_minutes),0)::bigint estimated_minutes,COALESCE(sum(t.estimate_minutes) FILTER(WHERE t.status='done'),0)::bigint completed_minutes FROM sprint_tasks st JOIN tasks t ON t.id=st.task_id WHERE st.sprint_id=$1 AND t.archived=false`,[sid]),
 rows('SELECT snapshot_date,total_tasks,remaining_tasks,completed_tasks,remaining_minutes FROM sprint_snapshots WHERE sprint_id=$1 ORDER BY snapshot_date',[sid]),
 rows(`SELECT s.id,s.name,s.end_date,count(st.task_id) FILTER(WHERE t.status='done')::int completed FROM sprints s JOIN projects p ON p.id=s.project_id LEFT JOIN sprint_tasks st ON st.sprint_id=s.id LEFT JOIN tasks t ON t.id=st.task_id WHERE p.workspace_id=$1 AND s.state='closed' GROUP BY s.id ORDER BY s.end_date DESC LIMIT 12`,[wid])
 ]);return {sprint,totals,snapshots,velocity,history_note:'Snapshots start when the worker first observes each sprint; no pre-existing daily history is invented.'};});
 app.post('/api/workspaces/:wid/reminders/:id/snooze',async r=>{const {wid,u}=await scoped(r,'member'),until=checkInstant(body(r).until);assert(new Date(until).getTime()>Date.now()&&new Date(until).getTime()<Date.now()+31*864e5,'Snooze must be within 31 days');const result=await pool.query(`UPDATE reminders SET occurrence_at=COALESCE(occurrence_at,remind_at),remind_at=$1,snoozed_until=$1,state='pending' WHERE id=$2 AND workspace_id=$3 AND owner_id=$4 AND state IN ('pending','delivered') RETURNING id`,[until,params(r).id,wid,u.id]);assert(result.rowCount===1,'Reminder cannot be snoozed',409);await audit(u.id,wid,'reminder.snoozed',params(r).id);return {ok:true};});
 app.get('/api/account/export',async r=>{const u=auth(r);const ws=await rows<{id:string}>('SELECT id FROM workspaces WHERE kind=$1 AND owner_id=$2',['personal',u.id]);const ids=ws.map(x=>x.id);const [tasks,todos,reminders,projects]=await Promise.all([
 rows('SELECT id,title,description,status,priority,due_date,created_at FROM tasks WHERE workspace_id=ANY($1::uuid[])',[ids]),
 rows('SELECT id,title,done,due_date,created_at FROM todos WHERE workspace_id=ANY($1::uuid[])',[ids]),
 rows('SELECT id,title,remind_at,state,created_at FROM reminders WHERE workspace_id=ANY($1::uuid[])',[ids]),
 rows('SELECT id,name,description FROM projects WHERE workspace_id=ANY($1::uuid[])',[ids])]);
 return {format:'personal-tracker-export/v1',generated_at:new Date().toISOString(),profile:{id:u.id,name:u.name,email:u.email,timezone:u.timezone},workspaces:ws,tasks,todos,reminders,projects,note:'Team workspace content and credentials are not included'};});
}
