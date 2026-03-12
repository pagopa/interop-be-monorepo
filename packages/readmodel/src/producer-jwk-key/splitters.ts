import { ProducerJWKKey } from "pagopa-interop-models";
import { ProducerJWKKeySQL } from "pagopa-interop-readmodel-models";

export const splitProducerJWKKeyIntoObjectsSQL = (
  { producerKeychainId, alg, e, kid, kty, n, use, ...rest }: ProducerJWKKey,
  metadataVersion: number
): ProducerJWKKeySQL => {
  void (rest satisfies Record<string, never>);
  return {
    producerKeychainId,
    metadataVersion,
    alg,
    e,
    kid,
    kty,
    n,
    use,
  };
};
