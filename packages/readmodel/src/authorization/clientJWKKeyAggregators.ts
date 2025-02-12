import {
  ClientJWKKey,
  ClientJWKKeySQL,
  WithMetadata,
} from "pagopa-interop-models";

export const clientJWKKeySQLToClientJWKKey = ({
  client_id,
  metadata_version,
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
      clientId: client_id,
      alg,
      e,
      kid,
      kty,
      n,
      use,
    },
    metadata: {
      version: metadata_version,
    },
  };
};
