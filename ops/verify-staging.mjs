#!/usr/bin/env node
// Read-only HTTP staging checks. Does not create accounts or mutate application data.
const base=process.env.TARGET_URL;
if(!base||!/^https?:\/\//.test(base))throw Error('TARGET_URL=https://staging.example.com required');
const tests=[
  ['healthz','/healthz',200],['readyz','/readyz',200],
  ['setup-status','/api/setup/status',200],['anonymous-api-blocked','/api/auth/me',401],
  ['frontend','/',200],['unknown-api','/api/route-that-does-not-exist',404]
];
let failures=0;
for(const [name,path,expected] of tests){
 try{const response=await fetch(new URL(path,base),{redirect:'manual',signal:AbortSignal.timeout(7000)});
  const result=response.status===expected;
  if(path==='/'&&response.status===200){const csp=response.headers.get('content-security-policy')||'';if(!csp.includes("default-src 'self'"))throw Error('CSP header missing');}
  console.log(`${result?'PASS':'FAIL'} ${name}: HTTP ${response.status} (expected ${expected})`);if(!result)failures++;
 }catch(e){failures++;console.log(`FAIL ${name}: ${String(e)}`);}
}
// Transport and header checks against the public origin.
try{
 const r=await fetch(new URL('/',base),{redirect:'manual',signal:AbortSignal.timeout(7000)});
 const h=(n)=>r.headers.get(n)||'';
 const checks=[
  ['https-origin',base.startsWith('https://')],
  ['hsts',!base.startsWith('https://')||/max-age=\d+/.test(h('strict-transport-security'))],
  ['x-frame-options',h('x-frame-options').toUpperCase()==='DENY'],
  ['nosniff',h('x-content-type-options')==='nosniff'],
  ['no-x-powered-by',!h('x-powered-by')]
 ];
 for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failures++;}
 if(base.startsWith('https://')){
  const plain=base.replace(/^https:/,'http:');
  const r2=await fetch(new URL('/healthz',plain),{redirect:'manual',signal:AbortSignal.timeout(7000)}).catch(()=>null);
  const ok=!r2||[301,302,307,308].includes(r2.status);
  console.log(`${ok?'PASS':'FAIL'} http-redirects-to-https: ${r2?`HTTP ${r2.status}`:'no plain HTTP listener'}`);if(!ok)failures++;
 }
}catch(e){failures++;console.log(`FAIL headers: ${String(e)}`);}
if(failures){console.error(`${failures} staging checks failed`);process.exitCode=1;}else console.log('Read-only staging smoke checks passed. Full E2E still required.');
