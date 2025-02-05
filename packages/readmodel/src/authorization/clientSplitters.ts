import {
  Client,
  ClientKeySQL,
  ClientPurposeSQL,
  ClientSQL,
  ClientUserSQL,
} from "pagopa-interop-models";

export const splitClientIntoObjectsSQL = (
  {
    id,
    consumerId,
    name,
    purposes,
    description,
    users,
    kind,
    createdAt,
    keys,
    ...rest
  }: Client,
  version: number
): {
  clientSQL: ClientSQL;
  clientUsersSQL: ClientUserSQL[];
  clientPurposesSQL: ClientPurposeSQL[];
  clientKeysSQL: ClientKeySQL[];
} => {
  void (rest satisfies Record<string, never>);

  const clientSQL: ClientSQL = {
    id,
    version,
    consumer_id: consumerId,
    name,
    description,
    kind,
    created_at: createdAt,
  };

  const clientUsersSQL: ClientUserSQL[] = users.map((userId) => ({
    client_version: version,
    client_id: id,
    user_id: userId,
  }));

  const clientPurposesSQL: ClientPurposeSQL[] = purposes.map((purposeId) => ({
    client_version: version,
    client_id: id,
    purpose_id: purposeId,
  }));

  const clientKeysSQL: ClientKeySQL[] = keys.map((key) => ({
    client_version: version,
    client_id: id,
    user_id: key.userId,
    kid: key.kid,
    name: key.name,
    encoded_pem: key.encodedPem,
    algorithm: key.algorithm,
    use: key.use,
    created_at: key.createdAt,
  }));

  return {
    clientSQL,
    clientUsersSQL,
    clientPurposesSQL,
    clientKeysSQL,
  };
};
