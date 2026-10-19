// Read-only v0.1 SQLite -> PostgreSQL data importer.
// Dry-run by default; --apply is a deliberate operator choice. Backup BOTH databases first.
import { DatabaseSync } from 'node:sqlite';
import { Pool } from 'pg';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const idx=process.argv.indexOf('--source');
if(idx<0||!process.argv[idx+1])throw Error('Usage: npm run db:import-sqlite -- --source /path/tracker.sqlite [--apply]');
const source=resolve(process.argv[idx+1]);if(!existsSync(source))throw Error('SQLite input not found');
const sqlite=new DatabaseSync(source,{readOnly:true});
const tables=[
 ['settings','app_settings',{name:'name',value:'value'}],
 ['users','users',{id:'id',email:'email',name:'name',pass_hash:'pass_hash',system_role:'system_role',disabled:'disabled',timezone:'timezone',created_at:'created_at'}],
 ['identities','identities',{provider:'provider',subject:'subject',user_id:'user_id'}],
 ['workspaces','workspaces',{id:'id',name:'name',kind:'kind',owner_id:'owner_id',created_at:'created_at'}],
 ['members','members',{workspace_id:'workspace_id',user_id:'user_id',role:'role',joined_at:'joined_at'}],
 ['invites','invites',{token_hash:'token_hash',email:'email',workspace_id:'workspace_id',role:'role',created_by:'created_by',expires_at:'expires_at',used_at:'used_at'}],
 ['projects','projects',{id:'id',workspace_id:'workspace_id',name:'name',description:'description',archived:'archived',created_at:'created_at'}],
 ['tasks','tasks',{id:'id',workspace_id:'workspace_id',project_id:'project_id',title:'title',description:'description',status:'status',priority:'priority',important:'important',assignee_id:'assignee_id',due_date:'due_date',creator_id:'creator_id',position:'position',version:'version',completed_at:'completed_at',archived:'archived',created_at:'created_at',updated_at:'updated_at'}],
 ['comments','comments',{id:'id',task_id:'task_id',user_id:'user_id',body:'body',created_at:'created_at'}],
 ['todo_lists','todo_lists',{id:'id',workspace_id:'workspace_id',name:'name',owner_id:'owner_id',created_at:'created_at'}],
 ['todos','todos',{id:'id',workspace_id:'workspace_id',list_id:'list_id',task_id:'task_id',title:'title',done:'done',important:'important',due_date:'due_date',creator_id:'creator_id',created_at:'created_at'}],
 ['reminders','reminders',{id:'id',workspace_id:'workspace_id',owner_id:'owner_id',title:'title',remind_at:'remind_at',state:'state',important:'important',task_id:'task_id',created_at:'created_at'}],
 ['notifications','notifications',{id:'id',user_id:'user_id',workspace_id:'workspace_id',reminder_id:'reminder_id',message:'message',created_at:'created_at',read_at:'read_at'}],
 ['sprints','sprints',{id:'id',project_id:'project_id',name:'name',start_date:'start_date',end_date:'end_date',state:'state',created_at:'created_at'}],
 ['sprint_tasks','sprint_tasks',{sprint_id:'sprint_id',task_id:'task_id'}],
 ['my_day','my_day',{user_id:'user_id',task_id:'task_id',plan_date:'plan_date'}],
 ['focus_sessions','focus_sessions',{id:'id',user_id:'user_id',task_id:'task_id',kind:'kind',planned_sec:'planned_sec',started_at:'started_at',ends_at:'ends_at',ended_at:'ended_at',state:'state'}],
 ['ai_proposals','ai_proposals',{id:'id',user_id:'user_id',workspace_id:'workspace_id',summary:'summary',action_json:'action_json',state:'state',created_at:'created_at',updated_at:'updated_at'}],
 ['audit','audit',{id:'id',actor_id:'actor_id',workspace_id:'workspace_id',action:'action',target_id:'target_id',meta:'meta',created_at:'created_at'}]
];
const booleanColumns=new Set(['users.disabled','projects.archived','tasks.important','tasks.archived','todos.done','todos.important','reminders.important']);
const jsonColumns=new Set(['ai_proposals.action_json','audit.meta']);
const apply=process.argv.includes('--apply');
console.log(`Migration mode: ${apply?'APPLY':'DRY RUN'} | SQLite ${source}`);
const pg=apply?new Pool({connectionString:process.env.DATABASE_URL,max:1}):null;
const client=pg?await pg.connect():null;
try{
 if(client){await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(378771122)');const cnt=await client.query('SELECT count(*)::int AS count FROM users');if(cnt.rows[0].count!==0)throw Error('Target users table must be empty. Refusing to import into a populated database.');}
 for(const [src,dest,mapping] of tables){const records=sqlite.prepare(`SELECT * FROM ${src}`).all();console.log(`${src.padEnd(17)} => ${String(dest).padEnd(17)} ${records.length}`);
  if(!client)continue;
  for(const rec of records){const row=rec;const cols=Object.entries(mapping);const keys=cols.map(([k,v])=>v);const values=cols.map(([key])=>{const val=row[key];if(val==null)return null;if(booleanColumns.has(`${dest}.${key}`))return !!val;if(jsonColumns.has(`${dest}.${key}`))return JSON.stringify(JSON.parse(String(val)));return val;});const params=keys.map((_,i)=>`$${i+1}`);
    if(dest==='app_settings'){await client.query(`INSERT INTO app_settings(name,value) VALUES($1,$2) ON CONFLICT(name) DO UPDATE SET value=EXCLUDED.value`,values);continue;}
    await client.query(`INSERT INTO ${dest} (${keys.join(',')}) VALUES(${params.join(',')}) ON CONFLICT DO NOTHING`,values);
  }
 }
 if(client){await client.query('COMMIT');console.log('Import committed. Review row counts and log in with pre-existing password.');}
 else console.log('Dry-run finished; no PostgreSQL data was changed.');
} catch(error){if(client)await client.query('ROLLBACK');throw error;}
finally{client?.release();await pg?.end();sqlite.close();}
console.warn('Intentionally NOT imported: sessions, oauth_states, auth_limits, AI API keys. Reconnect AI providers after import.');
