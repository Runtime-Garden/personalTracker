import { Pool } from 'pg';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
if (!process.env.DATABASE_URL) throw Error('DATABASE_URL is required');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const client = await pool.connect();
try {
  await client.query('SELECT pg_advisory_lock(378771120)');
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
  const dir=resolve('db/migrations');
  const files=(await readdir(dir)).filter(n=>/^\d{4}_[a-z0-9_]+\.sql$/.test(n)).sort();
  for(const name of files) {
    const content=await readFile(resolve(dir,name),'utf8');
    const sum=createHash('sha256').update(content).digest('hex');
    const prev=await client.query('SELECT sha256 FROM schema_migrations WHERE filename=$1',[name]);
    if(prev.rows.length) {
      if(prev.rows[0].sha256!==sum) throw Error(`Migration checksum mismatch: ${name}`);
      console.log(`ok ${name}`); continue;
    }
    if(process.argv.includes('--status')){console.log(`pending ${name}`);continue;}
    await client.query('BEGIN');
    try {await client.query(content);await client.query('INSERT INTO schema_migrations(filename,sha256) VALUES($1,$2)',[name,sum]);await client.query('COMMIT');console.log(`applied ${name}`);}
    catch(e){await client.query('ROLLBACK');throw e;}
  }
} finally { await client.query('SELECT pg_advisory_unlock(378771120)').catch(()=>{});client.release();await pool.end(); }
