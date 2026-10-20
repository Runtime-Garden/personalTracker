import React,{useEffect,useRef,useState} from 'react';

/** Shared modal behaviour: Escape closes, focus moves into the dialog and back to the opener, background scroll is locked. */
export function useModal(onClose:()=>void){
 const ref=useRef<HTMLDivElement|null>(null),close=useRef(onClose);close.current=onClose;
 // Captured during the first render, before autoFocus moves focus into the dialog.
 const openerRef=useRef<HTMLElement|null>(typeof document!=='undefined'?document.activeElement as HTMLElement|null:null);
 useEffect(()=>{
  const opener=openerRef.current;
  const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const first=ref.current?.querySelector<HTMLElement>('[autofocus],input:not([type=hidden]),select,textarea,button:not(.dialog-close)');
  (first||ref.current)?.focus();
  const onKey=(e:KeyboardEvent)=>{
   if(e.key==='Escape'){e.stopPropagation();close.current();return;}
   if(e.key!=='Tab'||!ref.current)return;
   const focusable=[...ref.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')];
   if(!focusable.length)return;const firstEl=focusable[0]!,last=focusable[focusable.length-1]!;
   if(e.shiftKey&&document.activeElement===firstEl){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();firstEl.focus();}
  };
  document.addEventListener('keydown',onKey);
  return()=>{document.removeEventListener('keydown',onKey);document.body.style.overflow=previousOverflow;if(opener?.isConnected)opener.focus();};
 },[]);
 return ref;
}

export function Dialog({title,onClose,children,wide}:{title:string;onClose:()=>void;children:React.ReactNode;wide?:boolean}){
 const ref=useModal(onClose);
 return <div className="modal-backdrop" role="presentation" onClick={onClose}><div ref={ref} tabIndex={-1} className={`modal${wide?' wide':''}`} role="dialog" aria-modal="true" aria-label={title} onClick={e=>e.stopPropagation()}><div className="modal-header"><h2>{title}</h2><button type="button" className="iconbtn dialog-close" onClick={onClose} aria-label="Close dialog">×</button></div>{children}</div></div>;
}

/** Shows one-time values (invite tokens, recovery codes) until the user dismisses them, with a copy button. */
export function SecretDialog({title,description,values,onClose}:{title:string;description:string;values:string[];onClose:()=>void}){
 const [copied,setCopied]=useState(false);
 const copy=()=>void navigator.clipboard?.writeText(values.join('\n')).then(()=>setCopied(true),()=>setCopied(false));
 return <Dialog title={title} onClose={onClose}><p>{description}</p><div className="secret-list">{values.map(v=><code key={v}>{v}</code>)}</div><div className="dialog-actions"><button type="button" className="btn subtle" onClick={copy}>{copied?'Copied':'Copy'}</button><button type="button" className="btn primary" onClick={onClose}>I have saved it</button></div></Dialog>;
}

/** Re-authentication prompt with a real password field (never window.prompt). */
export function ConfirmIdentityDialog({title,description,onSubmit,onClose}:{title:string;description:string;onSubmit:(v:{password:string;code:string})=>Promise<void>;onClose:()=>void}){
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 return <Dialog title={title} onClose={onClose}><form className="form-stack" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);setBusy(true);setError('');
   void onSubmit({password:String(f.get('password')||''),code:String(f.get('code')||'')}).then(onClose,(x:unknown)=>{setError(x instanceof Error?x.message:String(x));setBusy(false);});}}>
  <p>{description}</p>{error&&<div className="alert error" role="alert">{error}</div>}
  <label>Account password<input name="password" type="password" autoComplete="current-password" autoFocus/></label>
  <label>Authenticator or recovery code <small>(only for accounts without a password)</small><input name="code" inputMode="numeric" autoComplete="one-time-code"/></label>
  <div className="dialog-actions"><button type="button" className="btn subtle" onClick={onClose}>Cancel</button><button className="btn danger" disabled={busy}>{busy?'Working…':'Confirm'}</button></div>
 </form></Dialog>;
}
