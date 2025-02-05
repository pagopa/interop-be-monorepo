import {
  ProducerJWKKey,
  ProducerJWKKeySQL,
  WithMetadata,
} from "pagopa-interop-models";

export const producerJWKKeySQLToProducerJWKKey = ({
  producer_keychain_id,
  version,
  alg,
  e,
  kid,
  kty,
  n,
  use,
  ...rest
}: ProducerJWKKeySQL): WithMetadata<ProducerJWKKey> => {
  void (rest satisfies Record<string, never>);
  return {
    data: {
      producerKeychainId: producer_keychain_id,
      alg,
      e,
      kid,
      kty,
      n,
      use,
    },
    metadata: { version },
  };
};
