import {
  Client,
  ClientId,
  ClientKind,
  Key,
  KeyUse,
  PurposeId,
  stringToDate,
  TenantId,
  unsafeBrandId,
  UserId,
  WithMetadata,
} from "pagopa-interop-models";
import {
  ClientKeySQL,
  ClientPurposeSQL,
  ClientSQL,
  ClientUserSQL,
} from "pagopa-interop-readmodel-models";

export const clientSQLToClient = (
  {
    id,
    metadataVersion,
    consumerId,
    name,
    description,
    kind,
    createdAt,
    ...rest
  }: ClientSQL,
  clientUsersSQL: ClientUserSQL[],
  clientPurposesSQL: ClientPurposeSQL[],
  clientKeysSQL: ClientKeySQL[]
): WithMetadata<Client> => {
  void (rest satisfies Record<string, never>);

  const users: UserId[] = clientUsersSQL.map((u) =>
    unsafeBrandId<UserId>(u.userId)
  );
  const purposes: PurposeId[] = clientPurposesSQL.map((p) =>
    unsafeBrandId<PurposeId>(p.purposeId)
  );
  const keys: Key[] = clientKeysSQL.map((k) => ({
    userId: unsafeBrandId<UserId>(k.userId),
    kid: k.kid,
    name: k.name,
    encodedPem: k.encodedPem,
    algorithm: k.algorithm,
    use: KeyUse.parse(k.use),
    createdAt: stringToDate(k.createdAt),
  }));

  return {
    data: {
      id: unsafeBrandId<ClientId>(id),
      consumerId: unsafeBrandId<TenantId>(consumerId),
      name,
      purposes,
      description: description || undefined,
      users,
      kind: ClientKind.parse(kind),
      createdAt: stringToDate(createdAt),
      keys,
    },
    metadata: { version: metadataVersion },
  };
};
