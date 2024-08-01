import {
  JWKKey,
  missingRequiredJWKClaim,
  ClientKey,
} from "pagopa-interop-models";
import { createJWK } from "./jwk.js";

export const keyToJWKKey = (key: ClientKey): JWKKey => {
  const jwk = createJWK(key.encodedPem);
  if (!jwk.e || !jwk.kty || !jwk.n) {
    throw missingRequiredJWKClaim();
  }
  return {
    clientId: key.clientId,
    kid: key.kid,
    use: key.use,
    alg: key.algorithm,
    e: jwk.e,
    kty: jwk.kty,
    n: jwk.n,
  };
};
