import {
  ProducerJWKKey,
  unsafeBrandId,
  WithMetadata,
} from "pagopa-interop-models";
import { ProducerJWKKeySQL } from "pagopa-interop-readmodel-models";

export const aggregateProducerJWKKeyArray = (
  producersJWKKeySQL: ProducerJWKKeySQL[]
): Array<WithMetadata<ProducerJWKKey>> =>
  producersJWKKeySQL.map(aggregateProducerJWKKey);

export const aggregateProducerJWKKey = ({
  producerKeychainId,
  metadataVersion,
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
      producerKeychainId: unsafeBrandId(producerKeychainId),
      alg,
      e,
      kid,
      kty,
      n,
      use,
    },
    metadata: { version: metadataVersion },
  };
};
