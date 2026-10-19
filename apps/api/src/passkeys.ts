import type {FastifyInstance,FastifyRequest} from 'fastify';
import {generateRegistrationOptions,verifyRegistrationResponse,generateAuthenticationOptions,verifyAuthenticationResponse} from '@simplewebauthn/server';
import {pool,tx,one,rows,assert,named,audit,HttpError} from './db.js';
import {token,hash,createSession,type User,permitLogin,loginFailed,loginSucceeded} from './auth.js';

type PasskeyRow={id:string;user_id:string;public_key:Buffer;counter:string;transports:string[];label:string};
const body=(r:FastifyRequest)=>r.body as Record<string,unknown>||{};
const rpConfig=()=>{
  const origin=process.env.APP_URL||'';
  const url=new URL(origin);
  assert((url.protocol==='https:'||url.hostname==='localhost')&&!url.pathname.replace(/\/$/,'')&&!url.search,'APP_URL must be a dedicated HTTPS origin',503);
  return {origin:url.origin,rpID:url.hostname,rpName:'Personal Tracker · Runtime Garden'};
};
async function createChallenge(user:string,purpose:'registration'|'authentication',challenge:string){
  const flow=token();await pool.query('INSERT INTO passkey_challenges(flow_hash,user_id,purpose,challenge,expires_at) VALUES($1,$2,$3,$4,now()+interval \'5 minutes\')',[hash(flow),user,purpose,challenge]);
  return flow;
}
async function consumeChallenge(flow:string,user:string|null,purpose:string){
  assert(/^[a-zA-Z0-9_-]{20,256}$/.test(flow),'Invalid authentication flow',400);
  const record=await one<{user_id:string;challenge:string}>(`DELETE FROM passkey_challenges WHERE flow_hash=$1 AND purpose=$2 AND expires_at>now() ${user?'AND user_id=$3':''} RETURNING user_id,challenge`,user?[hash(flow),purpose,user]:[hash(flow),purpose]);
  assert(record,'Expired or already used passkey challenge',403);return record;
}
function limitedCredentials(list:PasskeyRow[]){return list.map(k=>({id:k.id,transports:k.transports as any}));}
// Cryptographic verification is always performed by SimpleWebAuthn, not by app-written CBOR/COSE code.
export function registerPasskeys(app:FastifyInstance,auth:(req:FastifyRequest)=>User,cookie:(raw:string)=>string){
  app.get('/api/auth/passkeys',async req=>{
    const user=auth(req);return rows('SELECT id,label,created_at,last_used_at FROM passkeys WHERE user_id=$1 ORDER BY created_at DESC',[user.id]);
  });
  app.post('/api/auth/passkeys/register/options',async req=>{
    const user=auth(req),cfg=rpConfig(),keys=await rows<PasskeyRow>('SELECT * FROM passkeys WHERE user_id=$1',[user.id]);
    const options=await generateRegistrationOptions({rpName:cfg.rpName,rpID:cfg.rpID,userName:user.email,userDisplayName:user.name,userID:Buffer.from(user.id,'utf8'),attestationType:'none',excludeCredentials:limitedCredentials(keys),authenticatorSelection:{residentKey:'preferred',userVerification:'required'}});
    return {flow:await createChallenge(user.id,'registration',options.challenge),options};
  });
  app.post('/api/auth/passkeys/register/verify',async req=>{
    const user=auth(req),cfg=rpConfig(),b=body(req),challenge=await consumeChallenge(named(b.flow,'flow',256),user.id,'registration');
    assert(b.response&&typeof b.response==='object','Credential response required');
    const proof=await verifyRegistrationResponse({response:b.response as any,expectedChallenge:challenge.challenge,expectedOrigin:cfg.origin,expectedRPID:cfg.rpID,requireUserVerification:true});
    assert(proof.verified&&proof.registrationInfo,'Passkey attestation failed',403);
    const {credential,credentialDeviceType,credentialBackedUp}=proof.registrationInfo;
    await pool.query('INSERT INTO passkeys(id,user_id,public_key,counter,transports,device_type,backed_up) VALUES($1,$2,$3,$4,$5,$6,$7)',[credential.id,user.id,Buffer.from(credential.publicKey),credential.counter,JSON.stringify(credential.transports||[]),credentialDeviceType,credentialBackedUp]);
    await audit(user.id,null,'auth.passkey.register',credential.id);return {ok:true};
  });
  app.post('/api/auth/passkeys/login/options',async req=>{
    const cfg=rpConfig(),address=String(body(req).email||'').trim().toLowerCase();assert(address.length<=254,'Invalid email');
    const bucket=`passkey:${hash(address||'invalid')}`;await permitLogin(bucket);await loginFailed(bucket);
    const user=await one<{id:string}>('SELECT id FROM users WHERE lower(email)=$1 AND disabled=false',[address]);
    assert(user,'No enrolled passkey for that account',403);
    const keys=await rows<PasskeyRow>('SELECT * FROM passkeys WHERE user_id=$1',[user.id]);assert(keys.length>0,'No enrolled passkey for that account',403);
    const options=await generateAuthenticationOptions({rpID:cfg.rpID,allowCredentials:limitedCredentials(keys),userVerification:'required'});
    return {flow:await createChallenge(user.id,'authentication',options.challenge),options};
  });
  app.post('/api/auth/passkeys/login/verify',async(req,reply)=>{
    const cfg=rpConfig(),b=body(req);assert(b.response&&typeof b.response==='object','Credential response required');
    const record=await consumeChallenge(named(b.flow,'flow',256),null,'authentication');
    const response=b.response as {id?:string};assert(response.id&&response.id.length<=1024,'Credential ID required');
    const key=await one<PasskeyRow>(`SELECT k.* FROM passkeys k JOIN users u ON u.id=k.user_id WHERE k.id=$1 AND k.user_id=$2 AND u.disabled=false`,[response.id,record.user_id]);
    assert(key,'Unknown credential',403);
    let result;
    try{result=await verifyAuthenticationResponse({response:b.response as any,expectedChallenge:record.challenge,expectedOrigin:cfg.origin,expectedRPID:cfg.rpID,requireUserVerification:true,credential:{id:key.id,publicKey:new Uint8Array(key.public_key),counter:Number(key.counter),transports:key.transports as any}});}
    catch{throw new HttpError(403,'Passkey validation failed');}
    assert(result.verified,'Passkey validation failed',403);
    const updated=await pool.query(`UPDATE passkeys SET counter=$1,last_used_at=now() WHERE id=$2 AND user_id=$3 AND counter=$4 RETURNING id`,[result.authenticationInfo.newCounter,key.id,record.user_id,key.counter]);
    assert(updated.rowCount===1,'Concurrent credential use: retry login',409);
    const owner=await one<{email:string}>('SELECT email FROM users WHERE id=$1',[record.user_id]);if(owner)await loginSucceeded(`passkey:${hash(owner.email.trim().toLowerCase())}`);
    const session=await createSession(record.user_id);reply.header('set-cookie',cookie(session.raw));await audit(record.user_id,null,'auth.passkey.login',key.id);
    return {csrf:session.csrf};
  });
  app.delete('/api/auth/passkeys/:id',async req=>{
    const user=auth(req),key=(req.params as {id:string}).id,b=body(req);
    // Removing a credential requires fresh proof of an active login's password or enabled second factor.
    const {passwordOK}=await import('./auth.js');
    const row=await one<{pass_hash:string|null;totp_enabled_at:Date|null}>('SELECT pass_hash,totp_enabled_at FROM users WHERE id=$1',[user.id]);
    if(row?.pass_hash)assert(passwordOK(String(b.password||''),row.pass_hash),'Password confirmation required',403);
    else{assert(row?.totp_enabled_at,'Account recovery must be enabled before removing the passkey',403);const {validateSecondFactor}=await import('./security.js');await validateSecondFactor(user.id,String(b.code||''));}
    await tx(async c=>{
      const factors=await one<{count:number}>('SELECT (SELECT count(*)::int FROM identities WHERE user_id=$1)+(SELECT count(*)::int FROM passkeys WHERE user_id=$1) AS count',[user.id],c);
      assert(row?.pass_hash||(factors?.count||0)>1,'Cannot remove the last available login method',409);
      const deleted=await c.query('DELETE FROM passkeys WHERE id=$1 AND user_id=$2 RETURNING id',[key,user.id]);assert(deleted.rowCount===1,'Passkey not found',404);
      await audit(user.id,null,'auth.passkey.remove',key,{},c);
    });return {ok:true};
  });
}
