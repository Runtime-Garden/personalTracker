import React,{useEffect,useState} from 'react';
type API=<T=any>(path:string,method?:string,body?:unknown)=>Promise<T>;
export function IdentityLinks({api}:{api:API}){
 const [connected,setConnected]=useState<Array<{provider:string}>>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const providers=['google','github','microsoft'];
 async function refresh(){setConnected(await api('/api/auth/identities'));}
 useEffect(()=>{void refresh().catch(e=>setMessage(String(e)))},[]);
 async function link(provider:string){setBusy(true);try{const response=await api<{url:string}>(`/api/auth/${provider}/link/start`,'POST',{});window.location.assign(response.url);}catch(e){setMessage(String(e));setBusy(false)}}
 async function unlink(provider:string){const password=prompt('Confirm with your account password, or your authenticator code if this account has no password:');if(!password)return;setBusy(true);try{await api(`/api/auth/identities/${provider}/unlink`,'POST',{password,code:password});await refresh();setMessage('Identity disconnected.')}catch(e){setMessage(String(e))}finally{setBusy(false)}}
 return <section className="panel"><h2>Connected sign-in providers</h2><p>Linking requires your existing signed-in session and explicit authorization with the provider. Matching emails alone never link accounts.</p>{message&&<p role="status">{message}</p>}{providers.map(provider=>{const linked=connected.some(x=>x.provider===provider);return <div className="mini-row" key={provider}><span>{provider[0]!.toUpperCase()+provider.slice(1)} · {linked?'Connected':'Not connected'}</span><button className="btn subtle" disabled={busy} onClick={()=>void(linked?unlink(provider):link(provider))}>{linked?'Disconnect':'Connect'}</button></div>})}</section>;
}
