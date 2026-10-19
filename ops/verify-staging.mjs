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
if(failures){console.error(`${failures} staging checks failed`);process.exitCode=1;}else console.log('Read-only staging smoke checks passed. Full E2E still required.');
