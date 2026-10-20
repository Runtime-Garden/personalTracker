import React,{useEffect,useState} from 'react';
import {ConfirmIdentityDialog} from './Dialogs.js';
type API=<T=any>(path:string,method?:string,body?:unknown)=>Promise<T>;
export function IdentityLinks({api}:{api:API}){
 const [connected,setConnected]=useState<Array<{provider:string}>>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[unlinking,setUnlinking]=useState<string|null>(null);
 const providers=['google','github','microsoft'];
 async function refresh(){setConnected(await api('/api/auth/identities'));}
 useEffect(()=>{void refresh().catch(e=>setMessage(e instanceof Error?e.message:String(e)))},[]);
 async function link(provider:string){setBusy(true);try{const response=await api<{url:string}>(`/api/auth/${provider}/link/start`,'POST',{});window.location.assign(response.url);}catch(e){setMessage(e instanceof Error?e.message:String(e));setBusy(false)}}
 async function unlink(provider:string,proof:{password:string;code:string}){await api(`/api/auth/identities/${provider}/unlink`,'POST',proof);await refresh();setMessage('Identity disconnected.');}
 const name=(p:string)=>p[0]!.toUpperCase()+p.slice(1);
 return <section className="feature-section"><h2>Connected sign-in providers</h2><p>Linking requires your existing signed-in session and explicit authorization with the provider. Matching emails alone never link accounts.</p>{message&&<p role="status">{message}</p>}{providers.map(provider=>{const linked=connected.some(x=>x.provider===provider);return <div className="mini-row" key={provider}><span>{name(provider)} · {linked?'Connected':'Not connected'}</span><button className="btn subtle" disabled={busy} aria-label={`${linked?'Disconnect':'Connect'} ${name(provider)}`} onClick={()=>linked?setUnlinking(provider):void link(provider)}>{linked?'Disconnect':'Connect'}</button></div>})}{unlinking&&<ConfirmIdentityDialog title={`Disconnect ${name(unlinking)}`} description="Confirm your identity to remove this sign-in method." onClose={()=>setUnlinking(null)} onSubmit={proof=>unlink(unlinking,proof)}/>}</section>;
}
