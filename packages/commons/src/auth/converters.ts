import {
  JWKKey,
  missingRequiredJWKClaim,
  Key,
  ClientId,
} from "pagopa-interop-models";
import { createJWK, decodeBase64ToPem } from "./jwk.js";

export const keyToJWKKey = (key: Key, clientId: ClientId): JWKKey => {
  const jwk = createJWK(decodeBase64ToPem(key.encodedPem));
  if (!jwk.e || !jwk.kty || !jwk.n) {
    throw missingRequiredJWKClaim();
  }
  return {
    clientId,
    kid: key.kid,
    use: key.use,
    alg: key.algorithm,
    e: jwk.e,
    kty: jwk.kty,
    n: jwk.n,
  };
};
