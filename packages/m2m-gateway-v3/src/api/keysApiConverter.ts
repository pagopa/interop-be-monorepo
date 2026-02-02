import { authorizationApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";

export function toM2MJWK(key: authorizationApi.JWKKey): m2mGatewayApiV3.JWK {
  return {
    kid: key.kid,
    kty: key.kty,
    "x5t#S256": key["x5t#S256"],
    alg: key.alg,
    crv: key.crv,
    d: key.d,
    dp: key.dp,
    dq: key.dq,
    e: key.e,
    k: key.k,
    key_ops: key.key_ops,
    n: key.n,
    oth: key.oth,
    p: key.p,
    q: key.q,
    qi: key.qi,
    use: key.use,
    x: key.x,
    x5c: key.x5c,
    x5t: key.x5t,
    x5u: key.x5u,
    y: key.y,
  };
}

export function toM2MKey({
  clientId,
  jwk,
}: authorizationApi.ClientJWK): m2mGatewayApiV3.Key {
  return {
    clientId,
    jwk: toM2MJWK(jwk),
  };
}

export function toM2MProducerKey({
  jwk,
  producerKeychainId,
}: authorizationApi.ProducerJWK): m2mGatewayApiV3.ProducerKey {
  return {
    producerKeychainId,
    jwk: toM2MJWK(jwk),
  };
}
