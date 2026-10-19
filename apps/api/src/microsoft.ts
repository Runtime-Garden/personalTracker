import type {FastifyInstance,FastifyRequest} from 'fastify';
import {createHash,verify} from 'node:crypto';
import {pool,one,tx,assert} from './db.js';
import {rsaPublicKeyFromJwk} from './jwk.js';
import {token,hash,createUser,createSession} from './auth.js';
import {createLoginChallenge} from './security.js';
import {finalizeLink} from './oauth-link.js';
import {sessionFromCookie} from './auth.js';

// Tenant-bound Azure/Microsoft Entra OIDC: no "common" tenant or implicit email account merge.
// Azure tenant must be explicitly configured so token issuer and key authority are fixed.
export function registerMicrosoft(app:FastifyInstance,origin:string,cookie:(raw:string)=>string){
 const config=()=>{
   const tenant=process.env.MICROSOFT_TENANT_ID||'',client=process.env.MICROSOFT_CLIENT_ID||'',secret=process.env.MICROSOFT_CLIENT_SECRET||'';
   assert(/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(tenant)&&client&&secret,'Microsoft Entra OAuth is not configured for a fixed tenant',503);
   return {tenant,client,secret,issuer:`https://login.microsoftonline.com/${tenant}/v2.0`};
 };
 async function microsoftStart(req:FastifyRequest,reply:import('fastify').FastifyReply,link=false){
   const cfg=config(),q=req.query as {return_to?:string};const state=token(),nonce=token(),verifier=token();
   const linkUser=link?await sessionFromCookie(req.headers.cookie):null;assert(!link||linkUser,'Authentication required for linking',401);
   const returnTo=q.return_to?.startsWith('/')&&!q.return_to.startsWith('//')?q.return_to:'/';
   await pool.query(`INSERT INTO oauth_states(state_hash,nonce,verifier,return_to,link_session_hash,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '10 minutes')`,[hash(state),nonce,verifier,returnTo,linkUser?.token_hash||null]);
   const url=new URL(`${cfg.issuer}/oauth2/v2.0/authorize`);
   for(const [k,v] of Object.entries({client_id:cfg.client,response_type:'code',redirect_uri:`${origin}/api/auth/microsoft/callback`,scope:'openid profile email',response_mode:'query',state,nonce,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}))url.searchParams.set(k,v);
   if(link)return {url:url.toString()};reply.redirect(url.toString());
 }
 app.get('/api/auth/microsoft/start',async(req,reply)=>microsoftStart(req,reply));
 app.post('/api/auth/microsoft/link/start',async(req,reply)=>microsoftStart(req,reply,true));
 app.get('/api/auth/microsoft/callback',async(req,reply)=>{
   const cfg=config(),q=req.query as {state?:string;code?:string};assert(q.code&&q.state,'Missing OIDC callback data');
   const state=await tx(async c=>{const record=await one<{verifier:string;nonce:string;return_to:string;link_session_hash:string|null}>(`SELECT verifier,nonce,return_to,link_session_hash FROM oauth_states WHERE state_hash=$1 AND expires_at>now() FOR UPDATE`,[hash(q.state!)],c);assert(record,'Invalid or expired state',403);await c.query('DELETE FROM oauth_states WHERE state_hash=$1',[hash(q.state!)]);return record;});
   const response=await fetch(`${cfg.issuer}/oauth2/v2.0/token`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:cfg.client,client_secret:cfg.secret,code:q.code!,grant_type:'authorization_code',redirect_uri:`${origin}/api/auth/microsoft/callback`,code_verifier:state.verifier}),signal:AbortSignal.timeout(10000),redirect:'error'});
   assert(response.ok,'Microsoft token exchange failed',502);const data=await response.json() as {id_token?:string};assert(data.id_token,'OIDC identity token missing',401);
   const parts=data.id_token.split('.');assert(parts.length===3,'Malformed OIDC token',401);
   const header=JSON.parse(Buffer.from(parts[0]!,'base64url').toString()) as {alg?:string;kid?:string};
   const claims=JSON.parse(Buffer.from(parts[1]!,'base64url').toString()) as {iss?:string;aud?:string;nonce?:string;tid?:string;sub?:string;name?:string;preferred_username?:string;email?:string;exp?:number;iat?:number};
   assert(header.alg==='RS256'&&header.kid,'Unsupported signature algorithm',401);
   const jwksResp=await fetch(`https://login.microsoftonline.com/${cfg.tenant}/discovery/v2.0/keys`,{signal:AbortSignal.timeout(10000),redirect:'error'});
   assert(jwksResp.ok,'Microsoft signing keys unavailable',503);const jwks=await jwksResp.json() as {keys:Array<Record<string,unknown>>};
   const jwk=jwks.keys.find(k=>k.kid===header.kid&&k.kty==='RSA');assert(jwk,'Unknown signing key',401);
   const pub=rsaPublicKeyFromJwk(jwk);
   assert(verify('RSA-SHA256',Buffer.from(`${parts[0]}.${parts[1]}`),pub,Buffer.from(parts[2]!,'base64url')),'Invalid OIDC signature',401);
   assert(claims.iss===cfg.issuer&&claims.tid===cfg.tenant&&claims.aud===cfg.client&&claims.nonce===state.nonce&&typeof claims.sub==='string'&&claims.sub.length>0&&typeof claims.exp==='number'&&claims.exp*1000>Date.now()&&typeof claims.iat==='number'&&claims.iat*1000<Date.now()+60000,'Invalid OIDC claims',401);
   const sub=`${cfg.tenant}:${claims.sub}`;
   // Microsoft preferred_username is not a verified email claim. Never grant invitation by it.
   const email=String(claims.email||claims.preferred_username||'').trim().toLowerCase();
   if(await finalizeLink(req,state.link_session_hash,'microsoft',sub)){reply.redirect('/?linked=microsoft');return;}
   const uid=await tx(async c=>{
     const existing=await one<{user_id:string}>('SELECT user_id FROM identities WHERE provider=$1 AND subject=$2',['microsoft',sub],c);if(existing)return existing.user_id;
     const signup=await one<{value:string}>("SELECT value FROM app_settings WHERE name='signup_mode'",[],c);
     assert(signup?.value==='open','Microsoft account requires open signup; existing identity login remains allowed',403);
     assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&email.length<=254,'Microsoft account has no usable email',403);
     const conflict=await one('SELECT id FROM users WHERE lower(email)=$1',[email],c);assert(!conflict,'Existing email account: sign in using its registered method',409);
     const user=await createUser(email,String(claims.name||email).slice(0,160),null,'user',c);
     await c.query('INSERT INTO identities(provider,subject,user_id) VALUES($1,$2,$3)',['microsoft',sub,user]);return user;
   });
   const account=await one<{disabled:boolean;totp_enabled_at:Date|null}>('SELECT disabled,totp_enabled_at FROM users WHERE id=$1',[uid]);assert(account&&!account.disabled,'Account disabled',403);
   if(account.totp_enabled_at){reply.redirect(`/?mfa_challenge=${encodeURIComponent(await createLoginChallenge(uid))}`);return;}
   const session=await createSession(uid);reply.header('set-cookie',cookie(session.raw));reply.redirect(state.return_to);
 });
}
