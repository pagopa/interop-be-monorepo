import { ProducerJWKKey } from "pagopa-interop-models";
import { ProducerJWKKeySQL } from "../types.js";

export const splitProducerJWKKeyIntoObjectsSQL = (
  { producerKeychainId, alg, e, kid, kty, n, use, ...rest }: ProducerJWKKey,
  version: number
): ProducerJWKKeySQL => {
  void (rest satisfies Record<string, never>);
  return {
    producerKeychainId,
    metadataVersion: version,
    alg,
    e,
    kid,
    kty,
    n,
    use,
  };
};
