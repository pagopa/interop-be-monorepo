import {
  ClientJWKKey,
  unsafeBrandId,
  WithMetadata,
} from "pagopa-interop-models";
import { ClientJWKKeySQL } from "pagopa-interop-readmodel-models";

export const clientJWKKeySQLToClientJWKKey = ({
  clientId,
  metadataVersion,
  alg,
  e,
  kid,
  kty,
  n,
  use,
  ...rest
}: ClientJWKKeySQL): WithMetadata<ClientJWKKey> => {
  void (rest satisfies Record<string, never>);
  return {
    data: {
      clientId: unsafeBrandId(clientId),
      alg,
      e,
      kid,
      kty,
      n,
      use,
    },
    metadata: {
      version: metadataVersion,
    },
  };
};
