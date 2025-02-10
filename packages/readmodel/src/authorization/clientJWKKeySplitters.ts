import { ClientJWKKey, ClientJWKKeySQL } from "pagopa-interop-models";

export const splitClientJWKKeyIntoObjectsSQL = (
  { clientId, alg, e, kid, kty, n, use, ...rest }: ClientJWKKey,
  version: number
): ClientJWKKeySQL => {
  void (rest satisfies Record<string, never>);
  return {
    client_id: clientId,
    metadata_version: version,
    alg,
    e,
    kid,
    kty,
    n,
    use,
  };
};
