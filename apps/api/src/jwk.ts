import {createPublicKey,type KeyObject} from 'node:crypto';
import {assert} from './db.js';

// Build an RSA verification key from an untrusted JWKS entry, accepting only the public modulus/exponent.
export function rsaPublicKeyFromJwk(jwk:Record<string,unknown>):KeyObject{
  const {kty,n,e}=jwk;
  assert(kty==='RSA'&&typeof n==='string'&&n.length>0&&typeof e==='string'&&e.length>0,'Invalid identity signing key',401);
  return createPublicKey({key:{kty,n,e},format:'jwk'});
}
