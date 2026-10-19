import {pool,tx,id,now} from './db.js';
import {deliverEmailBatch} from './email-worker.js';
// Idempotent reminder occurrence. Postgres row locks protect concurrent workers.
export async function tick():Promise<number>{return tx(async c=>{
  const due=await c.query(`SELECT id,owner_id,workspace_id,title,remind_at,important,task_id,recurrence,timezone FROM reminders WHERE state='pending' AND remind_at<=now() ORDER BY remind_at FOR UPDATE SKIP LOCKED LIMIT 100`);
  for(const r of due.rows){await c.query(`INSERT INTO notifications(id,user_id,workspace_id,reminder_id,message) VALUES($1,$2,$3,$4,$5) ON CONFLICT(reminder_id) DO NOTHING`,[id(),r.owner_id,r.workspace_id,r.id,r.title]);await c.query(`UPDATE reminders SET state='delivered' WHERE id=$1 AND state='pending'`,[r.id]);
    if(r.recurrence)await c.query(`INSERT INTO reminders(id,workspace_id,owner_id,title,remind_at,important,task_id,recurrence,recurred_from_id,timezone)
      VALUES($1,$2,$3,$4,((($5::timestamptz AT TIME ZONE $10) + CASE $6 WHEN 'daily' THEN interval '1 day' WHEN 'weekly' THEN interval '7 days' WHEN 'monthly' THEN interval '1 month' END) AT TIME ZONE $10),$7,$8,$6,$9,$10)
      ON CONFLICT(recurred_from_id) DO NOTHING`,[id(),r.workspace_id,r.owner_id,r.title,r.remind_at,r.recurrence,r.important,r.task_id,r.id,r.timezone]);
  }
  await c.query(`INSERT INTO sprint_snapshots(sprint_id,snapshot_date,total_tasks,remaining_tasks,completed_tasks,remaining_minutes)
    SELECT s.id,(now() AT TIME ZONE $1)::date,count(t.id)::int,count(t.id) FILTER (WHERE t.status<>'done')::int,
      count(t.id) FILTER (WHERE t.status='done')::int,
      COALESCE(sum(t.estimate_minutes) FILTER (WHERE t.status<>'done'),0)::bigint
    FROM sprints s JOIN projects p ON p.id=s.project_id LEFT JOIN sprint_tasks st ON st.sprint_id=s.id
    LEFT JOIN tasks t ON t.id=st.task_id AND t.archived=false
    WHERE s.state='active' AND (now() AT TIME ZONE $1)::date BETWEEN s.start_date AND s.end_date
    GROUP BY s.id
    ON CONFLICT(sprint_id,snapshot_date) DO UPDATE SET total_tasks=EXCLUDED.total_tasks,remaining_tasks=EXCLUDED.remaining_tasks,completed_tasks=EXCLUDED.completed_tasks,remaining_minutes=EXCLUDED.remaining_minutes`,[process.env.TZ||'Europe/Riga']);
  await c.query(`INSERT INTO worker_state(name,value) VALUES('heartbeat',$1) ON CONFLICT(name) DO UPDATE SET value=EXCLUDED.value`,[now()]);return due.rowCount||0;
});}
let shuttingDown=false;
process.on('SIGINT',()=>{shuttingDown=true;});process.on('SIGTERM',()=>{shuttingDown=true;});
if(process.argv[1]?.endsWith('worker.js')||process.argv[1]?.endsWith('worker.ts')){(async()=>{while(!shuttingDown){try{const n=await tick();const email=await deliverEmailBatch();if(email.delivered||email.failed)console.info('Email batch processed',email);if(n){console.info('Delivered reminder notifications:',n);await pool.query("INSERT INTO job_runs(id,kind,state,ended_at,processed_count) VALUES($1,'reminder_delivery','succeeded',now(),$2)",[id(),n]);}}catch(e){console.error('Worker tick failed',e);try{await pool.query("INSERT INTO job_runs(id,kind,state,ended_at,error_message) VALUES($1,'reminder_delivery','failed',now(),'Worker execution failed')",[id()]);}catch{ /* Database may be unavailable; retain original error only */ }}await new Promise(r=>setTimeout(r,15000));}await pool.end();})().catch(e=>{console.error(e);process.exitCode=1;});}
