import { ProducerJWKKey, ProducerJWKKeySQL } from "pagopa-interop-models";

export const splitProducerJWKKeyIntoObjectsSQL = (
  { producerKeychainId, alg, e, kid, kty, n, use, ...rest }: ProducerJWKKey,
  version: number
): ProducerJWKKeySQL => {
  void (rest satisfies Record<string, never>);
  return {
    producer_keychain_id: producerKeychainId,
    metadata_version: version,
    alg,
    e,
    kid,
    kty,
    n,
    use,
  };
};
