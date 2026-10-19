import type {FastifyInstance,FastifyRequest} from 'fastify';
import {one,rows,tx,assert,audit,HttpError} from './db.js';
import {sessionFromCookie,passwordOK,type User} from './auth.js';
import {validateSecondFactor} from './security.js';

export async function finalizeLink(req:FastifyRequest,linkHash:string|null|undefined,provider:string,subject:string):Promise<boolean>{
 if(!linkHash)return false;
 const u=await sessionFromCookie(req.headers.cookie);assert(u&&u.token_hash===linkHash,'Account linking session expired or changed',403);
 await tx(async c=>{
   const existing=await one<{user_id:string}>('SELECT user_id FROM identities WHERE provider=$1 AND subject=$2 FOR UPDATE',[provider,subject],c);
   assert(!existing||existing.user_id===u.id,'This provider account is already linked to another user',409);
   if(!existing)await c.query('INSERT INTO identities(provider,subject,user_id) VALUES($1,$2,$3)',[provider,subject,u.id]);
   await audit(u.id,null,'auth.identity.linked',provider,{provider},c);
 });
 return true;
}
export function registerIdentitySettings(app:FastifyInstance,auth:(r:FastifyRequest)=>User){
 app.get('/api/auth/identities',async r=>{
   const u=auth(r);return rows('SELECT provider,created_at FROM identities WHERE user_id=$1 ORDER BY provider',[u.id]);
 });
 app.post('/api/auth/identities/:provider/unlink',async r=>{
   const u=auth(r),provider=(r.params as {provider:string}).provider,b=r.body as {password?:string;code?:string};
   assert(['google','github','microsoft'].includes(provider),'Unknown provider',400);
   const me=await one<{pass_hash:string|null;totp_enabled_at:Date|null}>('SELECT pass_hash,totp_enabled_at FROM users WHERE id=$1',[u.id]);
   if(me?.pass_hash)assert(passwordOK(String(b?.password||''),me.pass_hash),'Password confirmation required',403);
   else {assert(me?.totp_enabled_at,'Second factor enrollment required before unlink',403);await validateSecondFactor(u.id,String(b?.code||''));}
   await tx(async c=>{
     const row=await one<{subject:string}>('SELECT subject FROM identities WHERE provider=$1 AND user_id=$2 FOR UPDATE',[provider,u.id],c);assert(row,'Provider not linked',404);
     const factors=await one<{count:number}>(`SELECT (SELECT count(*)::int FROM identities WHERE user_id=$1)+(SELECT count(*)::int FROM passkeys WHERE user_id=$1) AS count`,[u.id],c);
     assert(me?.pass_hash||(factors?.count||0)>1,'Cannot remove the last available login method',409);
     await c.query('DELETE FROM identities WHERE user_id=$1 AND provider=$2',[u.id,provider]);
     await audit(u.id,null,'auth.identity.unlinked',provider,{provider},c);
   });
   return {ok:true};
 });
}
