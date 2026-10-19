import type {FastifyInstance,FastifyRequest} from 'fastify';
import {createHash} from 'node:crypto';
import {pool,one,tx,assert,rows,HttpError} from './db.js';
import {token,hash,createUser,createSession} from './auth.js';
import {createLoginChallenge} from './security.js';
import {finalizeLink} from './oauth-link.js';
import {sessionFromCookie} from './auth.js';
// GitHub OAuth App: authorization-code + state + PKCE, verified email only.
export function registerGitHub(app:FastifyInstance,origin:string,cookie:(s:string)=>string){
 async function githubStart(req:FastifyRequest,reply:import('fastify').FastifyReply,link=false){
   assert(process.env.GITHUB_CLIENT_ID&&process.env.GITHUB_CLIENT_SECRET,'GitHub login is not configured',503);
   const q=req.query as {invite?:string;return_to?:string},state=token(),nonce=token(),verifier=token();
   const linkUser=link?await sessionFromCookie(req.headers.cookie):null;assert(!link||linkUser,'Authentication required for linking',401);
   const returnTo=q.return_to?.startsWith('/')&&!q.return_to.startsWith('//')?q.return_to:'/';
   await pool.query(`INSERT INTO oauth_states(state_hash,nonce,verifier,return_to,invite_token_hash,link_session_hash,expires_at) VALUES($1,$2,$3,$4,$5,$6,now()+interval '10 minutes')`,[hash(state),nonce,verifier,returnTo,link?null:q.invite&&q.invite.length<150?hash(q.invite):null,linkUser?.token_hash||null]);
   const url=new URL('https://github.com/login/oauth/authorize');for(const [k,v] of Object.entries({client_id:process.env.GITHUB_CLIENT_ID!,redirect_uri:`${origin}/api/auth/github/callback`,scope:'read:user user:email',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}))url.searchParams.set(k,v);
   if(link)return {url:url.toString()};reply.redirect(url.toString());
 }
 app.get('/api/auth/github/start',async(req,reply)=>githubStart(req,reply));
 app.post('/api/auth/github/link/start',async(req,reply)=>githubStart(req,reply,true));
 app.get('/api/auth/github/callback',async(req,reply)=>{
   const q=req.query as {state?:string;code?:string};assert(q.state&&q.code,'Missing GitHub callback data');
   const state=await tx(async c=>{const v=await one<{verifier:string;return_to:string;invite_token_hash:string|null;link_session_hash:string|null}>(`SELECT verifier,return_to,invite_token_hash,link_session_hash FROM oauth_states WHERE state_hash=$1 AND expires_at>now() FOR UPDATE`,[hash(q.state!)],c);assert(v,'Invalid login state',403);await c.query('DELETE FROM oauth_states WHERE state_hash=$1',[hash(q.state!)]);return v;});
   assert(process.env.GITHUB_CLIENT_ID&&process.env.GITHUB_CLIENT_SECRET,'GitHub login is not configured',503);
   const response=await fetch('https://github.com/login/oauth/access_token',{method:'POST',headers:{accept:'application/json','content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:process.env.GITHUB_CLIENT_ID,client_secret:process.env.GITHUB_CLIENT_SECRET,code:q.code!,redirect_uri:`${origin}/api/auth/github/callback`,code_verifier:state.verifier}),signal:AbortSignal.timeout(10000),redirect:'error'});
   assert(response.ok,'GitHub token exchange failed',502);const result=await response.json() as {access_token?:string;token_type?:string;error?:string};assert(result.access_token&&result.token_type?.toLowerCase()==='bearer','GitHub authorization rejected',401);
   const headers={accept:'application/vnd.github+json',authorization:`Bearer ${result.access_token}`,'user-agent':'RuntimeGarden-PersonalTracker','x-github-api-version':'2022-11-28'};
   const [profileResult,emailResult]=await Promise.all([
     fetch('https://api.github.com/user',{headers,signal:AbortSignal.timeout(10000)}),
     fetch('https://api.github.com/user/emails',{headers,signal:AbortSignal.timeout(10000)})
   ]);
   assert(profileResult.ok&&emailResult.ok,'GitHub identity lookup failed',502);
   const profile=await profileResult.json() as {id?:number;name?:string;login?:string};
   const emails=await emailResult.json() as Array<{email:string;verified:boolean;primary:boolean}>;
   assert(Number.isSafeInteger(profile.id)&&profile.id!>0,'Invalid GitHub account',401);
   const selected=emails.find(x=>x.primary&&x.verified)||emails.find(x=>x.verified);
   assert(selected?.email,'Verified GitHub email required',403);const mail=selected.email.trim().toLowerCase();
   if(await finalizeLink(req,state.link_session_hash,'github',String(profile.id))){reply.redirect('/?linked=github');return;}
   const uid=await tx(async c=>{
     const existing=await one<{user_id:string}>('SELECT user_id FROM identities WHERE provider=$1 AND subject=$2',['github',String(profile.id)],c);if(existing)return existing.user_id;
     const conflict=await one('SELECT id FROM users WHERE lower(email)=$1',[mail],c);assert(!conflict,'Existing email account: sign in with your original method',409);
     const mode=await one<{value:string}>("SELECT value FROM app_settings WHERE name='signup_mode'",[],c);
     const invite=state.invite_token_hash?await one<{token_hash:string;workspace_id:string|null;role:string;email:string}>(`SELECT * FROM invites WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() FOR UPDATE`,[state.invite_token_hash],c):null;
     assert(mode?.value==='open'||(invite&&invite.email.toLowerCase()===mail),'Invitation required',403);
     const user=await createUser(mail,String(profile.name||profile.login||'GitHub user').slice(0,160),null,'user',c);
     await c.query('UPDATE users SET email_verified_at=now() WHERE id=$1',[user]);
     if(invite){if(invite.workspace_id)await c.query('INSERT INTO members(workspace_id,user_id,role) VALUES($1,$2,$3)',[invite.workspace_id,user,invite.role]);await c.query('UPDATE invites SET used_at=now() WHERE token_hash=$1',[invite.token_hash]);}
     await c.query('INSERT INTO identities(provider,subject,user_id) VALUES($1,$2,$3)',['github',String(profile.id),user]);return user;
   });
   const account=await one<{disabled:boolean;totp_enabled_at:Date|null}>('SELECT disabled,totp_enabled_at FROM users WHERE id=$1',[uid]);assert(account&&!account.disabled,'Account disabled',403);const MFA=!!account.totp_enabled_at;
   if(MFA){const challenge=await createLoginChallenge(uid);reply.redirect(`/?mfa_challenge=${encodeURIComponent(challenge)}`);return;}
   const session=await createSession(uid);reply.header('set-cookie',cookie(session.raw));reply.redirect(state.return_to);
 });
}
