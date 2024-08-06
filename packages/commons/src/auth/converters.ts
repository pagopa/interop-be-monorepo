import {
  ClientJWKKey,
  ProducerJWKKey,
  missingRequiredJWKClaim,
  Key,
  ClientId,
  ProducerKeychainId,
} from "pagopa-interop-models";
import { createJWK } from "./jwk.js";

export const keyToClientJWKKey = (
  key: Key,
  clientId: ClientId
): ClientJWKKey => {
  const jwk = createJWK(key.encodedPem);
  if (!jwk.e || !jwk.kty || !jwk.n) {
    throw missingRequiredJWKClaim();
  }
  return {
    clientId,
    kid: key.kid,
    use: key.use.toLowerCase(),
    alg: key.algorithm,
    e: jwk.e,
    kty: jwk.kty,
    n: jwk.n,
  };
};

export const keyToProducerJWKKey = (
  key: Key,
  producerKeychainId: ProducerKeychainId
): ProducerJWKKey => {
  const jwk = createJWK(key.encodedPem);
  if (!jwk.e || !jwk.kty || !jwk.n) {
    throw missingRequiredJWKClaim();
  }
  return {
    producerKeychainId,
    kid: key.kid,
    use: key.use.toLowerCase(),
    alg: key.algorithm,
    e: jwk.e,
    kty: jwk.kty,
    n: jwk.n,
  };
};
