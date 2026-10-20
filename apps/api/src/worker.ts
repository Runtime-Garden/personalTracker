import {writeFile} from 'node:fs/promises';
import {pool,tx,id,now} from './db.js';
import {deliverEmailBatch} from './email-worker.js';

// Next occurrence of a recurring series in the reminder's own timezone (wall-clock preserving across DST),
// skipping occurrences already in the past so a long outage does not replay every missed one.
const NEXT_OCCURRENCE=`(SELECT ((($1::timestamptz AT TIME ZONE $3) + k*step) AT TIME ZONE $3)
  FROM (SELECT CASE $2 WHEN 'daily' THEN interval '1 day' WHEN 'weekly' THEN interval '7 days' ELSE interval '1 month' END AS step) s,
       generate_series(1,5000) k
  WHERE ((($1::timestamptz AT TIME ZONE $3) + k*step) AT TIME ZONE $3) > now()
  ORDER BY k LIMIT 1)`;

// Idempotent reminder delivery. Row locks with SKIP LOCKED let several workers run safely.
export async function tick():Promise<number>{return tx(async c=>{
  const due=await c.query(`SELECT r.id,r.owner_id,r.workspace_id,r.title,r.remind_at,r.occurrence_at,r.important,r.task_id,r.recurrence,r.timezone,
      EXISTS(SELECT 1 FROM members m WHERE m.workspace_id=r.workspace_id AND m.user_id=r.owner_id) AS is_member
    FROM reminders r WHERE r.state='pending' AND r.remind_at<=now() ORDER BY r.remind_at FOR UPDATE OF r SKIP LOCKED LIMIT 100`);
  let delivered=0;
  for(const r of due.rows){
    if(!r.is_member){await c.query(`UPDATE reminders SET state='dismissed' WHERE id=$1`,[r.id]);continue;}
    const n=await c.query(`INSERT INTO notifications(id,user_id,workspace_id,reminder_id,occurrence_at,message) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,[id(),r.owner_id,r.workspace_id,r.id,r.remind_at,r.title]);
    delivered+=n.rowCount||0;
    await c.query(`UPDATE reminders SET state='delivered' WHERE id=$1 AND state='pending'`,[r.id]);
    if(r.recurrence){
      const next=await c.query<{at:Date|null}>(`SELECT ${NEXT_OCCURRENCE} AS at`,[r.occurrence_at||r.remind_at,r.recurrence,r.timezone]);
      const at=next.rows[0]?.at;
      if(at)await c.query(`INSERT INTO reminders(id,workspace_id,owner_id,title,remind_at,important,task_id,recurrence,recurred_from_id,timezone)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(recurred_from_id) DO NOTHING`,[id(),r.workspace_id,r.owner_id,r.title,at,r.important,r.task_id,r.recurrence,r.id,r.timezone]);
    }
  }
  await c.query(`INSERT INTO sprint_snapshots(sprint_id,snapshot_date,total_tasks,remaining_tasks,completed_tasks,remaining_minutes)
    SELECT s.id,(now() AT TIME ZONE $1)::date,count(t.id)::int,count(t.id) FILTER (WHERE t.status<>'done')::int,
      count(t.id) FILTER (WHERE t.status='done')::int,
      COALESCE(sum(t.estimate_minutes) FILTER (WHERE t.status<>'done'),0)::bigint
    FROM sprints s JOIN projects p ON p.id=s.project_id AND p.archived=false LEFT JOIN sprint_tasks st ON st.sprint_id=s.id
    LEFT JOIN tasks t ON t.id=st.task_id AND t.archived=false
    WHERE s.state='active' AND (now() AT TIME ZONE $1)::date BETWEEN s.start_date AND s.end_date
    GROUP BY s.id
    ON CONFLICT(sprint_id,snapshot_date) DO UPDATE SET total_tasks=EXCLUDED.total_tasks,remaining_tasks=EXCLUDED.remaining_tasks,completed_tasks=EXCLUDED.completed_tasks,remaining_minutes=EXCLUDED.remaining_minutes`,[process.env.TZ||'Europe/Riga']);
  await c.query(`INSERT INTO worker_state(name,value) VALUES('heartbeat',$1) ON CONFLICT(name) DO UPDATE SET value=EXCLUDED.value`,[now()]);
  return delivered;
});}

// Expired authentication artefacts are short-lived; delete them in small batches.
export async function cleanupExpired():Promise<number>{
  let total=0;
  for(const q of [
    `DELETE FROM sessions WHERE token_hash IN (SELECT token_hash FROM sessions WHERE expires_at<now() LIMIT 1000)`,
    `DELETE FROM oauth_states WHERE state_hash IN (SELECT state_hash FROM oauth_states WHERE expires_at<now() LIMIT 1000)`,
    `DELETE FROM passkey_challenges WHERE flow_hash IN (SELECT flow_hash FROM passkey_challenges WHERE expires_at<now() LIMIT 1000)`,
    `DELETE FROM one_time_tokens WHERE token_hash IN (SELECT token_hash FROM one_time_tokens WHERE expires_at<now()-interval '1 day' LIMIT 1000)`,
    `DELETE FROM security_rate_limits WHERE bucket IN (SELECT bucket FROM security_rate_limits WHERE reset_at<now()-interval '1 day' LIMIT 1000)`,
    `DELETE FROM auth_limits WHERE key IN (SELECT key FROM auth_limits WHERE blocked_until<now()-interval '1 day' LIMIT 1000)`
  ])total+=(await pool.query(q)).rowCount||0;
  return total;
}

let shuttingDown=false,wake:(()=>void)|null=null;
const stop=()=>{shuttingDown=true;wake?.();};
const sleep=(ms:number)=>new Promise<void>(r=>{const t=setTimeout(()=>{wake=null;r();},ms);wake=()=>{clearTimeout(t);wake=null;r();};});
export const HEARTBEAT_FILE=process.env.WORKER_HEARTBEAT_FILE||'/tmp/worker-heartbeat';

if(process.argv[1]?.endsWith('worker.js')||process.argv[1]?.endsWith('worker.ts')){
  process.on('SIGINT',stop);process.on('SIGTERM',stop);
  (async()=>{
    let lastCleanup=0;
    while(!shuttingDown){
      try{
        const n=await tick();const email=await deliverEmailBatch();
        if(email.delivered||email.failed)console.info('Email batch processed',email);
        if(n){console.info('Delivered reminder notifications:',n);await pool.query("INSERT INTO job_runs(id,kind,state,ended_at,processed_count) VALUES($1,'reminder_delivery','succeeded',now(),$2)",[id(),n]);}
        if(Date.now()-lastCleanup>3600_000){await cleanupExpired();lastCleanup=Date.now();}
        await writeFile(HEARTBEAT_FILE,String(Date.now())).catch(()=>{});
      }catch(e){console.error('Worker tick failed',e);try{await pool.query("INSERT INTO job_runs(id,kind,state,ended_at,error_message) VALUES($1,'reminder_delivery','failed',now(),'Worker execution failed')",[id()]);}catch{ /* Database may be unavailable; retain original error only */ }}
      if(!shuttingDown)await sleep(15000);
    }
    await pool.end();
  })().catch(e=>{console.error(e);process.exitCode=1;});
}
