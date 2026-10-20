import React,{useEffect,useState} from 'react';
import {ConfirmIdentityDialog} from './Dialogs.js';
import {startAuthentication,startRegistration,browserSupportsWebAuthn} from '@simplewebauthn/browser';

type API=<T=any>(path:string,method?:string,body?:unknown)=>Promise<T>;
export function PasskeysPanel({api}:{api:API}){
 const [keys,setKeys]=useState<Array<{id:string;label:string;created_at:string}>>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[removing,setRemoving]=useState<string|null>(null);
 async function refresh(){setKeys(await api('/api/auth/passkeys'));}
 useEffect(()=>{void refresh().catch(e=>setMessage(e instanceof Error?e.message:String(e)))},[]);
 async function enroll(){setBusy(true);setMessage('');try{
  const flow=await api<{flow:string;options:any}>('/api/auth/passkeys/register/options','POST',{});
  const response=await startRegistration({optionsJSON:flow.options});
  await api('/api/auth/passkeys/register/verify','POST',{flow:flow.flow,response});await refresh();setMessage('Passkey registered.');
 }catch(e){setMessage(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 async function remove(key:string,proof:{password:string;code:string}){await api(`/api/auth/passkeys/${encodeURIComponent(key)}`,'DELETE',proof);await refresh();setMessage('Passkey removed.');}
 return <section className="feature-section"><h2>Passkeys</h2><p>Sign in with your device's passkey. User verification is required.</p>{message&&<p role="status">{message}</p>}{keys.map(k=><div className="mini-row" key={k.id}><span>{k.label||'Passkey'} · {new Date(k.created_at).toLocaleDateString()}</span><button className="btn subtle" disabled={busy} aria-label={`Remove passkey ${k.label||''} added ${new Date(k.created_at).toLocaleDateString()}`} onClick={()=>setRemoving(k.id)}>Remove</button></div>)}{!keys.length&&<p className="muted">No passkeys registered.</p>}<button className="btn subtle" disabled={busy||!browserSupportsWebAuthn()} onClick={()=>void enroll()}>{busy?'Working…':'Add passkey'}</button>{!browserSupportsWebAuthn()&&<p>Your browser does not support passkeys.</p>}{removing&&<ConfirmIdentityDialog title="Remove passkey" description="Confirm your identity to remove this passkey." onClose={()=>setRemoving(null)} onSubmit={proof=>remove(removing,proof)}/>}</section>
}
export async function loginWithPasskey(api:API,email:string){
 const flow=await api<{flow:string;options:any}>('/api/auth/passkeys/login/options','POST',{email});
 const response=await startAuthentication({optionsJSON:flow.options});
 return api<{csrf:string}>('/api/auth/passkeys/login/verify','POST',{flow:flow.flow,response});
}
