import {
  ProducerJWKKey,
  unsafeBrandId,
  WithMetadata,
} from "pagopa-interop-models";
import { ProducerJWKKeySQL } from "../types.js";

export const producerJWKKeySQLToProducerJWKKey = ({
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
