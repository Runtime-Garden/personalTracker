import Fastify, {type FastifyRequest} from 'fastify';
import {readFile,stat} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {timingSafeEqual,createHash} from 'node:crypto';
import {pool,one,rows,tx,id,now,audit,HttpError,assert,named,optionalString,checkChoice,checkDate,checkInstant} from './db.js';
import {token,hash,hashPassword,passwordOK,sessionFromCookie,createSession,userWorkspaces,membership,createUser,permitLogin,loginFailed,loginSucceeded,consumeInvite,verifyGoogleToken,type User} from './auth.js';
import {registerTracking} from './tracking.js';
import {registerAgile} from './agile.js';
import {registerAI} from './ai.js';
import {registerSecurity,createLoginChallenge} from './security.js';
import {registerCollaboration} from './collaboration.js';
import {registerOperations} from './operations.js';
import {registerGitHub} from './social.js';
import {registerAdvanced} from './advanced.js';
import {registerMicrosoft} from './microsoft.js';
import {registerPasskeys} from './passkeys.js';
import {registerAIStreaming} from './ai-stream.js';
import {registerTriage} from './ai-triage.js';
import {registerIdentitySettings,finalizeLink} from './oauth-link.js';

declare module 'fastify' { interface FastifyRequest {actor:User|null} }
// TRUST_PROXY lists the exact reverse-proxy addresses/CIDRs (e.g. the NPM container subnet) allowed to set X-Forwarded-For.
// Without it every client behind the proxy shares one rate-limit bucket; never set it to "true".
const trustedProxies=(process.env.TRUST_PROXY||'').split(',').map(s=>s.trim()).filter(Boolean);
if(trustedProxies.some(p=>!/^[0-9a-f:.]+(\/\d{1,3})?$/i.test(p)))throw Error('TRUST_PROXY must contain only IP addresses or CIDR ranges');
export const app=Fastify({logger:{level:process.env.LOG_LEVEL||'info'},bodyLimit:512*1024,trustProxy:trustedProxies.length?trustedProxies:false,disableRequestLogging:true});
const origin=process.env.APP_URL||'http://localhost:3000';
const safeUser=(u:User)=>({id:u.id,name:u.name,email:u.email,timezone:u.timezone,system_role:u.system_role});
const b=(req:FastifyRequest)=>req.body as Record<string,any>||{};
// Route parameters are validated at runtime; a missing segment is a client error, never `undefined` in SQL.
const param=(req:FastifyRequest,key:string):string=>{const v=(req.params as Record<string,unknown>|undefined)?.[key];assert(typeof v==='string'&&v.length>0,`Missing route parameter ${key}`);return v;};
const secure=()=>process.env.COOKIE_SECURE!=='false';
const sessionSeconds=()=>Math.max(1,Math.min(30,Number(process.env.SESSION_DAYS||7)))*86400;
const cookie=(raw:string)=>`pt_session=${raw}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${sessionSeconds()}${secure()?'; Secure':''}`;
const clearCookie=()=>`pt_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure()?'; Secure':''}`;
const ctEqual=(a:string,c:string)=>a.length===c.length&&timingSafeEqual(Buffer.from(a),Buffer.from(c));
const requireUser=(req:FastifyRequest)=>{assert(req.actor,'Authentication required',401);return req.actor;};
const requireAdmin=(req:FastifyRequest)=>{const u=requireUser(req);assert(u.system_role==='admin','System administrator required',403);return u;};
app.addHook('onSend',async(_req,reply,payload)=>{
  reply.header('X-Content-Type-Options','nosniff');
  reply.header('X-Frame-Options','DENY');
  reply.header('Referrer-Policy','same-origin');
  reply.header('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  reply.header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
  if(origin.startsWith('https://'))reply.header('Strict-Transport-Security','max-age=31536000');
  return payload;
});
app.addHook('onRequest',async req=>{req.actor=await sessionFromCookie(req.headers.cookie);});
app.addHook('preHandler',async req=>{
  if(['GET','HEAD','OPTIONS'].includes(req.method)||!req.actor)return;
  // The token in a custom header is required even for same-origin browser requests.
  const sent=req.headers['x-csrf-token'];
  assert(typeof sent==='string'&&ctEqual(sent,req.actor.csrf),'CSRF verification failed',403);
  if(req.headers.origin)assert(req.headers.origin===origin,'Origin not allowed',403);
});
// Fixed-window, database-backed abuse guard for unauthenticated entry points.
// Use the reverse-proxy address conservatively; never trust a client-provided X-Forwarded-For header.
app.addHook('preHandler',async req=>{
  const limits:Record<string,{max:number;seconds:number}>={
    '/api/setup':{max:20,seconds:900},'/api/auth/login':{max:80,seconds:900},
    '/api/auth/register':{max:40,seconds:900},'/api/auth/password/forgot':{max:50,seconds:900},
    '/api/auth/mfa/login':{max:80,seconds:900}
  };
  const rule=limits[req.url.split('?')[0]||''];if(!rule||req.method!=='POST')return;
  const bucket=`entry:${req.url.split('?')[0]}:${createHash('sha256').update(req.ip).digest('hex').slice(0,32)}`;
  const x=await one<{attempts:number}>(`INSERT INTO security_rate_limits(bucket,attempts,reset_at)
    VALUES($1,1,now()+make_interval(secs=>$2))
    ON CONFLICT(bucket) DO UPDATE SET
      attempts=CASE WHEN security_rate_limits.reset_at<now() THEN 1 ELSE security_rate_limits.attempts+1 END,
      reset_at=CASE WHEN security_rate_limits.reset_at<now() THEN now()+make_interval(secs=>$2) ELSE security_rate_limits.reset_at END
    RETURNING attempts`,[bucket,rule.seconds]);
  assert((x?.attempts||0)<=rule.max,'Too many requests, try again later',429);
});
app.setErrorHandler((error,req,reply)=>{
  const e=error as Error & {statusCode?:number;code?:string};
  // PostgreSQL errors are mapped to generic client messages so constraint/table names never leak.
  const pg:Record<string,[number,string]>={'23505':[409,'Record already exists'],'23503':[400,'Referenced record does not exist'],'23514':[400,'Value violates a data rule'],'23502':[400,'Required value missing'],'22P02':[400,'Invalid identifier or value'],'22007':[400,'Invalid date or time'],'22008':[400,'Date or time out of range'],'22003':[400,'Number out of range'],'22001':[400,'Value too long']};
  const mapped=!(e instanceof HttpError)&&e.code?pg[e.code]:undefined;
  const code=e instanceof HttpError?e.statusCode:mapped?mapped[0]:(e.statusCode&&e.statusCode>=400&&e.statusCode<500?e.statusCode:500);
  if(code>=500)req.log.error({err:e},'API failure');
    // Application-authored HttpError messages (e.g. "AI provider returned HTTP 401") are safe to show; unexpected errors are not.
  const exposed=e instanceof HttpError?code!==500:code<500;
  reply.code(code).send({error:exposed?(mapped?mapped[1]:e.message):'Internal server error'});
});
app.get('/healthz',async()=>({status:'ok'}));
app.get('/readyz',async()=>{await pool.query('SELECT 1');return {status:'ready'};});
app.get('/api/setup/status',async()=>({needs_setup:!(await one('SELECT id FROM users LIMIT 1')),google_enabled:!!(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET),github_enabled:!!(process.env.GITHUB_CLIENT_ID&&process.env.GITHUB_CLIENT_SECRET),microsoft_enabled:!!(process.env.MICROSOFT_CLIENT_ID&&process.env.MICROSOFT_CLIENT_SECRET&&process.env.MICROSOFT_TENANT_ID)}));
app.post('/api/setup',async(req,reply)=>{
  const body=b(req);assert(typeof process.env.SETUP_TOKEN==='string'&&process.env.SETUP_TOKEN.length>=32,'Setup token not configured',503);
  assert(typeof body.setup_token==='string'&&ctEqual(body.setup_token,process.env.SETUP_TOKEN),'Invalid setup token',403);
  const password=String(body.password||'');assert(password.length>=12&&password.length<=128,'Password must be at least 12 characters');
  const email=named(body.email,'email',255).toLowerCase(),name=named(body.name,'name',160);
  assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Invalid email');
  const uid=await tx(async c=>{await c.query('SELECT pg_advisory_xact_lock(378771121)');const existing=await one('SELECT id FROM users LIMIT 1',[],c);assert(!existing,'Already initialized',409);return createUser(email,name,hashPassword(password),'admin',c);});
  const session=await createSession(uid);reply.header('set-cookie',cookie(session.raw));return {user:{id:uid,email,name,system_role:'admin'},csrf:session.csrf};
});
app.post('/api/auth/login',async(req,reply)=>{
  const body=b(req),email=String(body.email||'').trim().toLowerCase(),password=String(body.password||'');
  assert(email.length<255&&password.length<=128,'Invalid credentials',401);const key=`email:${email}`;await permitLogin(key);
  const u=await one<{id:string;pass_hash:string|null;disabled:boolean}>('SELECT id,pass_hash,disabled FROM users WHERE lower(email)=$1',[email]);
  if(!u||u.disabled||!passwordOK(password,u.pass_hash)){await loginFailed(key);throw new HttpError(401,'Invalid credentials');}
  await loginSucceeded(key);const second=await one('SELECT id FROM users WHERE id=$1 AND totp_enabled_at IS NOT NULL',[u.id]);if(second)return {mfa_required:true,challenge:await createLoginChallenge(u.id)};const session=await createSession(u.id);await audit(u.id,null,'auth.login',u.id);reply.header('set-cookie',cookie(session.raw));return {csrf:session.csrf};
});
app.post('/api/auth/register',async(req,reply)=>{
  const body=b(req);const email=named(body.email,'email',255).toLowerCase(),name=named(body.name,'name',160),password=String(body.password||'');
  assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&password.length>=12&&password.length<=128,'Invalid registration');
  const uid=await tx(async c=>{
    const mode=await one<{value:string}>("SELECT value FROM app_settings WHERE name='signup_mode'",[],c);
    let inv:null|{workspace_id:string|null;role:string}=null;
    if(body.invite)inv=await consumeInvite(String(body.invite),email,c);
    assert(mode?.value==='open'||inv,'Invitation required',403);
    const user=await createUser(email,name,hashPassword(password),'user',c);
    if(inv?.workspace_id)await c.query('INSERT INTO members(workspace_id,user_id,role) VALUES($1,$2,$3)',[inv.workspace_id,user,inv.role]);
    return user;
  });const session=await createSession(uid);reply.header('set-cookie',cookie(session.raw));return {user:{id:uid,email,name},csrf:session.csrf};
});
app.get('/api/auth/me',async req=>{const u=requireUser(req);const sessions=await rows('SELECT created_at,last_seen_at,expires_at FROM sessions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30',[u.id]);return {user:safeUser(u),csrf:u.csrf,sessions};});
app.post('/api/auth/logout',async(req,reply)=>{const u=requireUser(req);await pool.query('DELETE FROM sessions WHERE token_hash=$1',[u.token_hash]);reply.header('set-cookie',clearCookie());return {ok:true};});
app.post('/api/auth/logout-all',async(req,reply)=>{const u=requireUser(req);await pool.query('DELETE FROM sessions WHERE user_id=$1',[u.id]);reply.header('set-cookie',clearCookie());return {ok:true};});
app.patch('/api/profile',async req=>{const u=requireUser(req),body=b(req);const fields: string[]=[],args:unknown[]=[];
  if(body.name!==undefined){args.push(named(body.name,'name',160));fields.push(`name=$${args.length}`);}if(body.timezone!==undefined){const tz=named(body.timezone,'timezone',80);try{new Intl.DateTimeFormat('en-US',{timeZone:tz})}catch{throw new HttpError(400,'Invalid timezone')}args.push(tz);fields.push(`timezone=$${args.length}`);}assert(fields.length,'No changes');args.push(u.id);await pool.query(`UPDATE users SET ${fields.join(',')} WHERE id=$${args.length}`,args);return {ok:true};
});
// Google sign-in is optional. No automatic account linking solely by email.
async function startGoogle(req:FastifyRequest,reply:import('fastify').FastifyReply,link=false){
  assert(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET,'Google login is not configured',503);
  const state=token(),nonce=token(),verifier=token();const q=req.query as {return_to?:string};
  const linkUser=link?requireUser(req):null;
  const returnTo=q.return_to?.startsWith('/')&&!q.return_to.startsWith('//')?q.return_to:'/';
  const invite=(q as {invite?:string}).invite;
  await pool.query(`INSERT INTO oauth_states(state_hash,nonce,verifier,return_to,invite_token_hash,link_session_hash,expires_at) VALUES($1,$2,$3,$4,$5,$6,now()+interval '10 minutes')`,[hash(state),nonce,verifier,returnTo,link?null:invite&&invite.length<150?hash(invite):null,linkUser?.token_hash||null]);
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');const params={client_id:process.env.GOOGLE_CLIENT_ID!,redirect_uri:`${origin}/api/auth/google/callback`,response_type:'code',scope:'openid email profile',state,nonce,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',prompt:'select_account'};
  for(const [key,val] of Object.entries(params))url.searchParams.set(key,val);if(link)return {url:url.toString()};reply.redirect(url.toString());
}
app.get('/api/auth/google/start',async(req,reply)=>startGoogle(req,reply));
app.post('/api/auth/google/link/start',async(req,reply)=>startGoogle(req,reply,true));
app.get('/api/auth/google/callback',async(req,reply)=>{
  const q=req.query as {code?:string;state?:string};assert(q.code&&q.state,'Missing auth callback parameters',400);
  const state=await tx(async c=>{const s=await one<{nonce:string;verifier:string;return_to:string;invite_token_hash:string|null;link_session_hash:string|null}>(`SELECT nonce,verifier,return_to,invite_token_hash,link_session_hash FROM oauth_states WHERE state_hash=$1 AND expires_at>now() FOR UPDATE`,[hash(q.state!)],c);assert(s,'Invalid or expired auth state',403);await c.query('DELETE FROM oauth_states WHERE state_hash=$1',[hash(q.state!)]);return s;});
  assert(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET,'Google unavailable',503);
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code:q.code!,client_id:process.env.GOOGLE_CLIENT_ID!,client_secret:process.env.GOOGLE_CLIENT_SECRET!,redirect_uri:`${origin}/api/auth/google/callback`,grant_type:'authorization_code',code_verifier:state.verifier}),signal:AbortSignal.timeout(10000)});
  assert(response.ok,'Google token exchange failed',401);const data=await response.json() as {id_token?:string};assert(data.id_token,'Google identity missing',401);
  const claims=await verifyGoogleToken(data.id_token,process.env.GOOGLE_CLIENT_ID!,state.nonce);
  if(await finalizeLink(req,state.link_session_hash,'google',claims.sub)){reply.redirect('/?linked=google');return;}
  const uid=await tx(async c=>{const known=await one<{user_id:string}>('SELECT user_id FROM identities WHERE provider=$1 AND subject=$2',['google',claims.sub],c);if(known)return known.user_id;
    const conflict=await one('SELECT id FROM users WHERE lower(email)=$1',[claims.email.toLowerCase()],c);assert(!conflict,'Account with this email already exists; use its existing login',409);
    const mode=await one<{value:string}>("SELECT value FROM app_settings WHERE name='signup_mode'",[],c);
    const found=state.invite_token_hash?await one<{token_hash:string;workspace_id:string|null;role:string;email:string}>(`SELECT * FROM invites WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() FOR UPDATE`,[state.invite_token_hash],c):null;
    // An invitation is honoured only for the address it was issued to, even when signup is open.
    const invite=found&&found.email.toLowerCase()===claims.email.toLowerCase()?found:null;
    assert(mode?.value==='open'||invite,'Google signup requires a valid invitation',403);
    const result=await createUser(claims.email,claims.name||claims.email,null,'user',c);
    await c.query('UPDATE users SET email_verified_at=now() WHERE id=$1',[result]);
    if(invite){if(invite.workspace_id)await c.query('INSERT INTO members(workspace_id,user_id,role) VALUES($1,$2,$3)',[invite.workspace_id,result,invite.role]);await c.query('UPDATE invites SET used_at=now() WHERE token_hash=$1',[invite.token_hash]);}
    await c.query('INSERT INTO identities(provider,subject,user_id) VALUES($1,$2,$3)',['google',claims.sub,result]);return result;});
  const account=await one<{disabled:boolean;totp_enabled_at:Date|null}>('SELECT disabled,totp_enabled_at FROM users WHERE id=$1',[uid]);assert(account&&!account.disabled,'Account disabled',403);if(account.totp_enabled_at){reply.redirect(`/?mfa_challenge=${encodeURIComponent(await createLoginChallenge(uid))}`);return;}const session=await createSession(uid);reply.header('set-cookie',cookie(session.raw));reply.redirect(state.return_to);
});
registerGitHub(app,origin,cookie);
registerMicrosoft(app,origin,cookie);
registerPasskeys(app,requireUser,cookie);
registerAIStreaming(app,requireUser);
registerTriage(app,requireUser);
registerIdentitySettings(app,requireUser);
app.get('/api/bootstrap',async req=>{const u=requireUser(req);return {user:safeUser(u),csrf:u.csrf,workspaces:await userWorkspaces(u.id)};});
app.get('/api/workspaces',async req=>userWorkspaces(requireUser(req).id));
app.post('/api/workspaces',async req=>{const u=requireUser(req),body=b(req),name=named(body.name,'workspace name',160);const wid=id();await tx(async c=>{await c.query('INSERT INTO workspaces(id,name,kind,owner_id) VALUES($1,$2,$3,$4)',[wid,name,'team',u.id]);await c.query('INSERT INTO members(workspace_id,user_id,role) VALUES($1,$2,$3)',[wid,u.id,'owner']);await audit(u.id,wid,'workspace.created',wid,{},c);});return {id:wid,name,kind:'team',role:'owner'};});
app.get('/api/workspaces/:wid/members',async req=>{const u=requireUser(req),wid=param(req,'wid');await membership(u.id,wid);return rows('SELECT u.id,u.name,u.email,m.role,m.joined_at FROM members m JOIN users u ON u.id=m.user_id WHERE m.workspace_id=$1 ORDER BY m.joined_at',[wid]);});
app.post('/api/workspaces/:wid/invites',async req=>{const u=requireUser(req),wid=param(req,'wid'),body=b(req);await membership(u.id,wid,'admin');const w=await one<{kind:string}>('SELECT kind FROM workspaces WHERE id=$1',[wid]);assert(w?.kind==='team','Cannot invite into a personal workspace',403);const email=named(body.email,'email',255).toLowerCase(),role=checkChoice(body.role||'member',['admin','member','viewer'],'role');const raw=token();await pool.query(`INSERT INTO invites(token_hash,email,workspace_id,role,created_by,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '7 days')`,[hash(raw),email,wid,role,u.id]);await audit(u.id,wid,'invite.created',null,{email,role});return {invite_token:raw,expires_in_days:7};});
app.post('/api/invites/accept',async req=>{const u=requireUser(req),body=b(req);return tx(async c=>{const inv=await consumeInvite(String(body.token||''),u.email,c);assert(inv.workspace_id,'Invalid team invite',400);await c.query('INSERT INTO members(workspace_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT(workspace_id,user_id) DO NOTHING',[inv.workspace_id,u.id,inv.role]);await audit(u.id,inv.workspace_id,'invite.accepted',u.id,{},c);return {ok:true};});});
app.patch('/api/workspaces/:wid/members/:id',async req=>{const u=requireUser(req),wid=param(req,'wid'),target=param(req,'id'),body=b(req);await membership(u.id,wid,'owner');const role=checkChoice(body.role,['owner','admin','member','viewer'],'role');assert(target!==u.id||role==='owner','Cannot demote yourself');await tx(async c=>{await c.query('SELECT id FROM workspaces WHERE id=$1 FOR UPDATE',[wid]);const old=await one<{role:string}>('SELECT role FROM members WHERE workspace_id=$1 AND user_id=$2 FOR UPDATE',[wid,target],c);assert(old,'Member missing',404);if(old.role==='owner'&&role!=='owner'){const cts=await one<{count:string}>("SELECT count(*)::text AS count FROM members WHERE workspace_id=$1 AND role='owner'",[wid],c);assert(Number(cts?.count)>1,'Cannot demote last owner');}await c.query('UPDATE members SET role=$1 WHERE workspace_id=$2 AND user_id=$3',[role,wid,target]);
  if(old.role==='owner'&&role!=='owner')await c.query("UPDATE workspaces SET owner_id=(SELECT user_id FROM members WHERE workspace_id=$1 AND role='owner' ORDER BY joined_at LIMIT 1) WHERE id=$1 AND owner_id=$2",[wid,target]);
  await audit(u.id,wid,'member.role',target,{role},c);});return {ok:true};});
app.delete('/api/workspaces/:wid/members/:id',async req=>{const u=requireUser(req),wid=param(req,'wid'),target=param(req,'id');await membership(u.id,wid,'admin');await tx(async c=>{await c.query('SELECT id FROM workspaces WHERE id=$1 FOR UPDATE',[wid]);const old=await one<{role:string}>(`SELECT role FROM members WHERE workspace_id=$1 AND user_id=$2 FOR UPDATE`,[wid,target],c);assert(old,'Member missing',404);if(old.role==='owner'){await membership(u.id,wid,'owner');const owners=await one<{count:string}>("SELECT count(*)::text AS count FROM members WHERE workspace_id=$1 AND role='owner'",[wid],c);assert(Number(owners?.count)>1,'Cannot remove last owner',409);}await c.query('DELETE FROM members WHERE workspace_id=$1 AND user_id=$2',[wid,target]);
  if(old.role==='owner')await c.query("UPDATE workspaces SET owner_id=(SELECT user_id FROM members WHERE workspace_id=$1 AND role='owner' ORDER BY joined_at LIMIT 1) WHERE id=$1 AND owner_id=$2",[wid,target]);
  await audit(u.id,wid,'member.removed',target,{},c);});return {ok:true};});
registerTracking(app,requireUser);
registerAgile(app,requireUser);
registerAI(app,requireUser);
registerSecurity(app,requireUser,cookie);
registerCollaboration(app,requireUser);
registerOperations(app,requireUser);
registerAdvanced(app,requireUser);
app.get('/api/notifications',async req=>{const u=requireUser(req);return rows('SELECT id,message,workspace_id,created_at,read_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',[u.id]);});
app.patch('/api/notifications/:id',async req=>{const u=requireUser(req);await pool.query('UPDATE notifications SET read_at=now() WHERE id=$1 AND user_id=$2',[param(req,'id'),u.id]);return {ok:true};});
app.get('/api/admin/settings',async req=>{requireAdmin(req);return {settings:await rows('SELECT name,value FROM app_settings ORDER BY name'),users:await rows('SELECT id,name,email,system_role,disabled,created_at FROM users ORDER BY created_at DESC LIMIT 200'),audit:await rows('SELECT action,created_at FROM audit ORDER BY created_at DESC LIMIT 40')};});
app.patch('/api/admin/settings',async req=>{const u=requireAdmin(req),body=b(req);const allowed:{[key:string]:string[]}={app_name:[],signup_mode:['open','invite_only']};assert(typeof body.name==='string'&&Object.hasOwn(allowed,body.name),'Setting unsupported');const value=named(body.value,'value',160);assert(!allowed[body.name]!.length||allowed[body.name]!.includes(value),'Setting value unsupported');await pool.query('UPDATE app_settings SET value=$1 WHERE name=$2',[value,body.name]);await audit(u.id,null,'setting.changed',body.name);return {ok:true};});
app.patch('/api/admin/users/:id',async req=>{const u=requireAdmin(req),body=b(req),target=param(req,'id');assert(target!==u.id,'You cannot disable or demote your own account',409);assert(typeof body.disabled==='boolean'||['admin','user'].includes(body.system_role),'Invalid change');if(typeof body.disabled==='boolean')await pool.query('UPDATE users SET disabled=$1 WHERE id=$2',[body.disabled,target]);if(body.system_role!==undefined)await pool.query('UPDATE users SET system_role=$1 WHERE id=$2',[checkChoice(body.system_role,['admin','user'],'role'),target]);await audit(u.id,null,'user.admin.changed',target);return {ok:true};});
app.post('/api/admin/invites',async req=>{const u=requireAdmin(req),email=named(b(req).email,'email',255).toLowerCase(),raw=token();await pool.query(`INSERT INTO invites(token_hash,email,role,created_by,expires_at) VALUES($1,$2,'member',$3,now()+interval '7 days')`,[hash(raw),email,u.id]);return {invite_token:raw};});
// Same-origin frontend: serve generated Vite assets without making a separate app/network.
const frontend=resolve('dist/web');
const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.map':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8'};
app.get('/*',async(req,reply)=>{let path:string;try{path=decodeURIComponent(new URL(req.url,origin).pathname);}catch{throw new HttpError(400,'Invalid path');}
  if(path.startsWith('/api/'))throw new HttpError(404,'Not found');
  const root=resolve(frontend),candidate=resolve(root,`.${path}`);
  assert(candidate===root||candidate.startsWith(root+sep),'Invalid file path',403);
  let target=candidate;
  try{const s=await stat(target);if(!s.isFile())target=resolve(root,'index.html');}
  catch{
    // Only extension-less paths are client-side routes; a missing asset must 404, not return HTML.
    if(extname(path))throw new HttpError(404,'Not found');
    target=resolve(root,'index.html');
  }
  let data:Buffer;try{data=await readFile(target);}catch{throw new HttpError(503,'Frontend not built; run npm run build:web');}
  reply.type(mime[extname(target)]||'application/octet-stream');
  reply.header('cache-control',target.endsWith('index.html')?'no-cache':/^\/assets\/[^/]+-[A-Za-z0-9_-]{8}\.(?:js|css|woff2?)$/.test(path)?'public, max-age=31536000, immutable':'public, max-age=3600');
  return reply.send(data);
});
export async function start(){
  // Graceful shutdown (registered before startup): stop accepting connections, finish in-flight requests, close the pool.
  let closing=false;const shutdown=(signal:string)=>{if(closing)return;closing=true;app.log.info({signal},'Shutting down');
    const force=setTimeout(()=>process.exit(1),20_000);force.unref();
    app.close().then(()=>pool.end()).then(()=>process.exit(0),()=>process.exit(1));};
  process.on('SIGTERM',()=>shutdown('SIGTERM'));process.on('SIGINT',()=>shutdown('SIGINT'));
  await pool.query('SELECT 1');await app.listen({host:'0.0.0.0',port:Number(process.env.PORT||3000)});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){start().catch(e=>{console.error(e);process.exit(1)});}
