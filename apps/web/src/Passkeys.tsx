import React,{useEffect,useState} from 'react';
import {startAuthentication,startRegistration,browserSupportsWebAuthn} from '@simplewebauthn/browser';

type API=<T=any>(path:string,method?:string,body?:unknown)=>Promise<T>;
export function PasskeysPanel({api}:{api:API}){
 const [keys,setKeys]=useState<Array<{id:string;label:string;created_at:string}>>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function refresh(){setKeys(await api('/api/auth/passkeys'));}
 useEffect(()=>{void refresh().catch(e=>setMessage(String(e)))},[]);
 async function enroll(){setBusy(true);setMessage('');try{
  const flow=await api<{flow:string;options:any}>('/api/auth/passkeys/register/options','POST',{});
  const response=await startRegistration({optionsJSON:flow.options});
  await api('/api/auth/passkeys/register/verify','POST',{flow:flow.flow,response});await refresh();setMessage('Passkey registered.');
 }catch(e){setMessage(String(e instanceof Error?e.message:e))}finally{setBusy(false)}}
 async function remove(key:string){const password=window.prompt('Enter your account password to remove this passkey. For accounts without a password, enter your current authenticator code.');if(!password)return;
  setBusy(true);try{await api(`/api/auth/passkeys/${encodeURIComponent(key)}`,'DELETE',{password,code:password});await refresh();setMessage('Passkey removed.')}catch(e){setMessage(String(e))}finally{setBusy(false)}}
 return <section className="panel"><h2>Passkeys</h2><p>Sign in with your device's passkey. User verification is required.</p>{message&&<p role="status">{message}</p>}{keys.map(k=><div className="mini-row" key={k.id}><span>{k.label} · {new Date(k.created_at).toLocaleDateString()}</span><button className="btn subtle" disabled={busy} onClick={()=>void remove(k.id)}>Remove</button></div>)}<button className="btn subtle" disabled={busy||!browserSupportsWebAuthn()} onClick={()=>void enroll()}>{busy?'Working…':'Add passkey'}</button>{!browserSupportsWebAuthn()&&<p>Your browser does not support passkeys.</p>}</section>
}
export async function loginWithPasskey(api:API,email:string){
 const flow=await api<{flow:string;options:any}>('/api/auth/passkeys/login/options','POST',{email});
 const response=await startAuthentication({optionsJSON:flow.options});
 return api<{csrf:string}>('/api/auth/passkeys/login/verify','POST',{flow:flow.flow,response});
}
