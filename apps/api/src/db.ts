import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';
import { randomUUID } from 'node:crypto';
if (!process.env.DATABASE_URL) throw Error('DATABASE_URL must be set');
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.DB_POOL_MAX||10), connectionTimeoutMillis:5000, idleTimeoutMillis:20000 });
export const orm = drizzle(pool, {schema});
export const id = () => randomUUID();
export const now = () => new Date().toISOString();
export type DB = pg.Pool | pg.PoolClient;
export async function rows<T=Record<string,unknown>>(q:string, args:unknown[]=[],client:DB=pool):Promise<T[]> { return (await client.query(q,args)).rows as T[]; }
export async function one<T=Record<string,unknown>>(q:string,args:unknown[]=[],client:DB=pool):Promise<T|null>{return (await rows<T>(q,args,client))[0]||null;}
export async function tx<T>(fn:(client:pg.PoolClient)=>Promise<T>):Promise<T>{ const c=await pool.connect();try{await c.query('BEGIN');const value=await fn(c);await c.query('COMMIT');return value;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();} }
export async function audit(actor:string|null,workspace:string|null,action:string,target:string|null,meta:object={},client:DB=pool){await client.query('INSERT INTO audit(id,actor_id,workspace_id,action,target_id,meta) VALUES($1,$2,$3,$4,$5,$6)',[id(),actor,workspace,action,target,JSON.stringify(meta)]);}
export class HttpError extends Error {constructor(public statusCode:number,message:string){super(message);}}
export function assert(v:unknown,message:string,status=400):asserts v{if(!v)throw new HttpError(status,message);}
export function named(value:unknown,label='Title',max=220):string{assert(typeof value==='string'&&value.trim().length>0&&value.trim().length<=max,`Invalid ${label}`);return value.trim();}
export function optionalString(value:unknown,max=5000):string{if(value==null)return '';assert(typeof value==='string'&&value.length<=max,'Invalid text');return value.trim();}
export function checkChoice(v:unknown,options:readonly string[],label:string):string{assert(typeof v==='string'&&options.includes(v),`Invalid ${label}`);return v;}
export function checkDate(v:unknown):string|null{if(v==null||v==='')return null;assert(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(`${v}T00:00:00Z`).toISOString().slice(0,10)===v,'Invalid YYYY-MM-DD');return v;}
export function checkInstant(v:unknown):string{assert(typeof v==='string'&&/(Z|[+-]\d\d:\d\d)$/.test(v)&&!Number.isNaN(Date.parse(v)),'Timestamp must include a timezone');return new Date(v).toISOString();}
