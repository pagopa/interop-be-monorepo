import { ClientJWKKey } from "pagopa-interop-models";
import { ClientJWKKeySQL } from "../types.js";

export const splitClientJWKKeyIntoObjectsSQL = (
  { clientId, alg, e, kid, kty, n, use, ...rest }: ClientJWKKey,
  metadataVersion: number
): ClientJWKKeySQL => {
  void (rest satisfies Record<string, never>);
  return {
    clientId,
    metadataVersion,
    alg,
    e,
    kid,
    kty,
    n,
    use,
  };
};
