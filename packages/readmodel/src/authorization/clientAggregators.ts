import {
  Client,
  ClientKeySQL,
  ClientPurposeSQL,
  ClientSQL,
  ClientUserSQL,
  Key,
  PurposeId,
  UserId,
  WithMetadata,
} from "pagopa-interop-models";

export const clientSQLToClient = (
  {
    id,
    metadata_version,
    consumer_id,
    name,
    description,
    kind,
    created_at,
    ...rest
  }: ClientSQL,
  clientUsersSQL: ClientUserSQL[],
  clientPurposesSQL: ClientPurposeSQL[],
  clientKeysSQL: ClientKeySQL[]
): WithMetadata<Client> => {
  void (rest satisfies Record<string, never>);

  const users: UserId[] = clientUsersSQL.map((u) => u.user_id);
  const purposes: PurposeId[] = clientPurposesSQL.map((p) => p.purpose_id);
  const keys: Key[] = clientKeysSQL.map((k) => ({
    userId: k.user_id,
    kid: k.kid,
    name: k.name,
    encodedPem: k.encoded_pem,
    algorithm: k.algorithm,
    use: k.use,
    createdAt: k.created_at,
  }));

  return {
    data: {
      id,
      consumerId: consumer_id,
      name,
      purposes,
      description,
      users,
      kind,
      createdAt: created_at,
      keys,
    },
    metadata: { version: metadata_version },
  };
};
