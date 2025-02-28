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
  ClientItemsSQL,
  ClientKeySQL,
  ClientPurposeSQL,
  ClientSQL,
  ClientUserSQL,
} from "pagopa-interop-readmodel-models";

export const aggregateClientSQL = ({
  clientSQL,
  usersSQL,
  purposesSQL,
  keysSQL,
}: ClientItemsSQL): WithMetadata<Client> => {
  const users: UserId[] = usersSQL.map((u) => unsafeBrandId<UserId>(u.userId));
  const purposes: PurposeId[] = purposesSQL.map((p) =>
    unsafeBrandId<PurposeId>(p.purposeId)
  );
  const keys: Key[] = keysSQL.map((keySQL) => ({
    userId: unsafeBrandId<UserId>(keySQL.userId),
    kid: keySQL.kid,
    name: keySQL.name,
    encodedPem: keySQL.encodedPem,
    algorithm: keySQL.algorithm,
    use: KeyUse.parse(keySQL.use),
    createdAt: stringToDate(keySQL.createdAt),
  }));

  return {
    data: {
      id: unsafeBrandId<ClientId>(clientSQL.id),
      consumerId: unsafeBrandId<TenantId>(clientSQL.consumerId),
      name: clientSQL.name,
      purposes,
      description: clientSQL.description || undefined,
      users,
      kind: ClientKind.parse(clientSQL.kind),
      createdAt: stringToDate(clientSQL.createdAt),
      keys,
    },
    metadata: { version: clientSQL.metadataVersion },
  };
};

export const aggregateClientSQLArray = ({
  clientsSQL,
  usersSQL,
  purposesSQL,
  keysSQL,
}: {
  clientsSQL: ClientSQL[];
  usersSQL: ClientUserSQL[];
  purposesSQL: ClientPurposeSQL[];
  keysSQL: ClientKeySQL[];
}): Array<WithMetadata<Client>> =>
  clientsSQL.map((clientSQL) =>
    aggregateClientSQL({
      clientSQL,
      usersSQL: usersSQL.filter((u) => u.clientId === clientSQL.id),
      purposesSQL: purposesSQL.filter((p) => p.clientId === clientSQL.id),
      keysSQL: keysSQL.filter((k) => k.clientId === clientSQL.id),
    })
  );
