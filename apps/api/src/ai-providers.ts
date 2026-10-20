import {request as httpsRequest} from 'node:https';
import {request as httpRequest} from 'node:http';
import {lookup as dnsLookup,type LookupAddress} from 'node:dns';
import {BlockList,isIP} from 'node:net';
import {Readable} from 'node:stream';
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {assert,HttpError} from './db.js';

// Fixed, vendor-operated endpoints. Their URLs are not user-controlled.
export const PRESET_ENDPOINTS:Record<string,string>={
  openai:'https://api.openai.com/v1/chat/completions',openrouter:'https://openrouter.ai/api/v1/chat/completions',
  deepseek:'https://api.deepseek.com/chat/completions',groq:'https://api.groq.com/openai/v1/chat/completions',
  mistral:'https://api.mistral.ai/v1/chat/completions',xai:'https://api.x.ai/v1/chat/completions',
  together:'https://api.together.xyz/v1/chat/completions',anthropic:'https://api.anthropic.com/v1/messages',
  google:'https://generativelanguage.googleapis.com/v1beta/models'
};
// User-supplied endpoints speaking one of the two de-facto wire formats.
export const CUSTOM_PROVIDERS=['openai_compatible','anthropic_compatible'] as const;
export const ALL_PROVIDERS=[...Object.keys(PRESET_ENDPOINTS),...CUSTOM_PROVIDERS].sort();
export type WireFormat='openai'|'anthropic'|'google';
export interface Connection {provider:string;model:string;base_url:string;secret_blob:string}

export function wireFormat(provider:string):WireFormat{
  if(provider==='anthropic'||provider==='anthropic_compatible')return 'anthropic';
  if(provider==='google')return 'google';
  return 'openai';
}
export const isCustom=(provider:string)=>(CUSTOM_PROVIDERS as readonly string[]).includes(provider);

// ---- secrets -------------------------------------------------------------------------------
const key=()=>{const v=process.env.APP_ENCRYPTION_KEY||'';assert(/^[0-9a-f]{64}$/i.test(v),'AI encryption key not configured',503);return Buffer.from(v,'hex');};
export const seal=(s:string)=>{const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);const data=Buffer.concat([cipher.update(s,'utf8'),cipher.final()]);return [iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),data.toString('base64url')].join('.');};
export const unseal=(s:string)=>{const [iv,tag,data]=s.split('.');assert(iv&&tag&&data,'Invalid encrypted secret',500);const dec=createDecipheriv('aes-256-gcm',key(),Buffer.from(iv,'base64url'));dec.setAuthTag(Buffer.from(tag,'base64url'));return Buffer.concat([dec.update(Buffer.from(data,'base64url')),dec.final()]).toString('utf8');};

// ---- SSRF protection for custom endpoints ------------------------------------------------------
const blocked=new BlockList();
for(const [net,prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]] as const)blocked.addSubnet(net,prefix,'ipv4');
for(const [net,prefix] of [['::',128],['::1',128],['fc00::',7],['fe80::',10],['ff00::',8],['2001:db8::',32],['64:ff9b::',96]] as const)blocked.addSubnet(net,prefix,'ipv6');
// Operators may allow specific internal hosts (e.g. a self-hosted vLLM/Ollama gateway): AI_ALLOWED_PRIVATE_HOSTS=llm.internal,10.0.0.5
const privateAllow=()=>new Set((process.env.AI_ALLOWED_PRIVATE_HOSTS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean));
export function isBlockedAddress(address:string):boolean{
  const family=isIP(address);if(!family)return true;
  if(family===6){const mapped=/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);if(mapped)return blocked.check(mapped[1]!,'ipv4');return blocked.check(address,'ipv6');}
  return blocked.check(address,'ipv4');
}
const hostAllowed=(host:string)=>privateAllow().has(host.toLowerCase());

/** Validates a user-supplied base URL and returns the concrete request endpoint for its wire format. */
export function customEndpoint(provider:string,raw:unknown):string{
  assert(typeof raw==='string'&&raw.length>0&&raw.length<=500,'Endpoint URL is required');
  let url:URL;try{url=new URL(raw.trim());}catch{throw new HttpError(400,'Invalid endpoint URL');}
  const host=url.hostname.replace(/^\[|\]$/g,'');
  assert(url.protocol==='https:'||(url.protocol==='http:'&&hostAllowed(host)),'Endpoint must use HTTPS',400);
  assert(!url.username&&!url.password&&!url.hash,'Endpoint URL must not contain credentials or a fragment',400);
  assert(!url.port||['443','80'].includes(url.port)||hostAllowed(host),'Endpoint port not allowed',400);
  if(isIP(host))assert(!isBlockedAddress(host)||hostAllowed(host),'Private or reserved network addresses are not allowed',400);
  else assert(host.includes('.')&&!/\.(local|internal|localhost|lan|home|corp)$/i.test(host)&&host.toLowerCase()!=='localhost'||hostAllowed(host),'Private hostnames are not allowed',400);
  const path=url.pathname.replace(/\/+$/,'');
  if(wireFormat(provider)==='anthropic')url.pathname=path.endsWith('/messages')?path:path.endsWith('/v1')?`${path}/messages`:`${path}/v1/messages`;
  else url.pathname=path.endsWith('/chat/completions')?path:`${path}/chat/completions`;
  url.search='';
  return url.toString();
}

function guardedLookup(host:string){
  const allow=hostAllowed(host);
  return (hostname:string,options:{all?:boolean;family?:number},cb:(err:NodeJS.ErrnoException|null,address:string|LookupAddress[],family?:number)=>void)=>{
    dnsLookup(hostname,{...options,all:true},(err,addresses)=>{
      if(err)return cb(err,'');
      const list=addresses as LookupAddress[];
      if(!allow&&(!list.length||list.some(a=>isBlockedAddress(a.address)))){const e=new Error('AI endpoint resolves to a private address') as NodeJS.ErrnoException;e.code='EBLOCKED';return cb(e,'');}
      if(options.all)cb(null,list);else cb(null,list[0]!.address,list[0]!.family);
    });
  };
}

/** fetch() replacement that re-validates every resolved IP at connect time (DNS rebinding safe) and refuses redirects. */
export function guardedFetch(target:string,init:{method:string;headers:Record<string,string>;body?:string;signal?:AbortSignal}):Promise<Response>{
  const url=new URL(target),host=url.hostname.replace(/^\[|\]$/g,'');
  if(isIP(host)&&isBlockedAddress(host)&&!hostAllowed(host))return Promise.reject(new HttpError(400,'Private or reserved network addresses are not allowed'));
  const send=url.protocol==='https:'?httpsRequest:httpRequest;
  return new Promise((resolve,reject)=>{
    const req=send(url,{method:init.method,headers:{...init.headers,...(init.body?{'content-length':String(Buffer.byteLength(init.body))}:{})},lookup:guardedLookup(host) as never,signal:init.signal},res=>{
      const status=res.statusCode||502;
      if(status>=300&&status<400){res.resume();reject(new HttpError(502,'AI endpoint redirects are not allowed'));return;}
      const headers=new Headers();for(const [k,v] of Object.entries(res.headers))if(v!==undefined)headers.set(k,Array.isArray(v)?v.join(', '):String(v));
      resolve(new Response(status===204?null:Readable.toWeb(res) as ReadableStream,{status:status<200||status>599?502:status,headers}));
    });
    req.on('error',e=>reject((e as NodeJS.ErrnoException).code==='EBLOCKED'?new HttpError(400,'AI endpoint resolves to a private or reserved address'):e));
    req.end(init.body);
  });
}

export function providerFetch(c:Connection,url:string,init:{method:string;headers:Record<string,string>;body?:string;signal?:AbortSignal}):Promise<Response>{
  if(isCustom(c.provider))return guardedFetch(url,init);
  return fetch(url,{...init,redirect:'error'});
}

/** Reads at most `max` bytes of a JSON body; oversized or malformed responses are provider errors. */
export async function readJson(response:Response,max=2*1024*1024):Promise<any>{
  const reader=response.body?.getReader();if(!reader)return null;
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel().catch(()=>{});throw new HttpError(502,'AI provider response too large');}chunks.push(value);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new HttpError(502,'AI provider returned invalid JSON');}
}

// ---- request building ----------------------------------------------------------------------------
export function chatRequest(c:Connection,secret:string,system:string,messages:Array<{role:'user'|'assistant';content:string}>,opts:{maxTokens:number;stream?:boolean;json?:boolean}):{url:string;headers:Record<string,string>;body:string}{
  const headers:Record<string,string>={'content-type':'application/json'};
  const format=wireFormat(c.provider);
  if(format==='anthropic'){
    headers['x-api-key']=secret;headers['anthropic-version']='2023-06-01';
    // Many Anthropic-compatible gateways authenticate with a bearer token instead of x-api-key.
    if(c.provider==='anthropic_compatible')headers.authorization=`Bearer ${secret}`;
    return {url:c.provider==='anthropic'?PRESET_ENDPOINTS.anthropic!:c.base_url,headers,body:JSON.stringify({model:c.model,system,messages,max_tokens:opts.maxTokens,...(opts.stream?{stream:true}:{})})};
  }
  if(format==='google'){
    headers['x-goog-api-key']=secret;
    return {url:`${PRESET_ENDPOINTS.google}/${encodeURIComponent(c.model)}:generateContent`,headers,body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:messages.map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]})),generationConfig:{maxOutputTokens:opts.maxTokens,...(opts.json?{responseMimeType:'application/json'}:{})}})};
  }
  headers.authorization=`Bearer ${secret}`;
  if(new URL(c.base_url).hostname==='openrouter.ai'){headers['x-title']='Personal Tracker';if(process.env.APP_URL)headers['http-referer']=process.env.APP_URL;}
  const url=isCustom(c.provider)?c.base_url:PRESET_ENDPOINTS[c.provider];
  assert(url,'Unapproved endpoint',400);
  return {url,headers,body:JSON.stringify({model:c.model,messages:[{role:'system',content:system},...messages],max_tokens:opts.maxTokens,...(opts.stream?{stream:true}:{}),...(opts.json?{response_format:{type:'json_object'}}:{})})};
}

export function parseCompletion(c:Connection,data:any):{text:string;input_tokens:number|null;output_tokens:number|null}{
  const format=wireFormat(c.provider);
  const text=format==='anthropic'?(Array.isArray(data?.content)?data.content.filter((x:any)=>x?.type==='text').map((x:any)=>x.text).join('\n'):undefined)
    :format==='google'?data?.candidates?.[0]?.content?.parts?.map((x:any)=>x?.text).join('\n'):data?.choices?.[0]?.message?.content;
  assert(typeof text==='string'&&text.trim(),'Empty model response',502);
  const num=(v:unknown)=>Number.isFinite(Number(v))&&v!==null&&v!==undefined?Number(v):null;
  const usage=format==='anthropic'?{i:data?.usage?.input_tokens,o:data?.usage?.output_tokens}:format==='google'?{i:data?.usageMetadata?.promptTokenCount,o:data?.usageMetadata?.candidatesTokenCount}:{i:data?.usage?.prompt_tokens,o:data?.usage?.completion_tokens};
  return {text:text.slice(0,20000),input_tokens:num(usage.i),output_tokens:num(usage.o)};
}

/** One non-streaming completion for any supported provider. */
export async function complete(c:Connection,system:string,message:string,opts:{maxTokens?:number;timeoutMs?:number;json?:boolean}={}){
  const req=chatRequest(c,unseal(c.secret_blob),system,[{role:'user',content:message}],{maxTokens:opts.maxTokens??1500,json:opts.json});
  let response:Response;
  try{response=await providerFetch(c,req.url,{method:'POST',headers:req.headers,body:req.body,signal:AbortSignal.timeout(opts.timeoutMs??25000)});}
  catch(e){if(e instanceof HttpError)throw e;throw new HttpError(502,(e as Error).name==='TimeoutError'?'AI provider timed out':'AI provider unreachable');}
  if(!response.ok){await response.body?.cancel().catch(()=>{});throw new HttpError(502,`AI provider returned HTTP ${response.status}`);}
  return parseCompletion(c,await readJson(response));
}

/** Extracts text deltas from one SSE data payload of either streaming wire format. */
export function streamDelta(provider:string,event:string):{text?:string;done?:boolean}{
  if(event==='[DONE]')return {done:true};
  let frame:any;try{frame=JSON.parse(event);}catch{return {};}
  if(wireFormat(provider)==='anthropic'){
    if(frame?.type==='message_stop')return {done:true};
    if(frame?.type==='content_block_delta'&&frame.delta?.type==='text_delta'&&typeof frame.delta.text==='string')return {text:frame.delta.text};
    if(frame?.type==='error')return {done:true};
    return {};
  }
  const chunk=frame?.choices?.[0]?.delta?.content;
  return typeof chunk==='string'&&chunk?{text:chunk}:{};
}
