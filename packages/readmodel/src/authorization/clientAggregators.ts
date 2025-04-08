import {
  Client,
  ClientKind,
  Key,
  KeyUse,
  PurposeId,
  stringToDate,
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

export const aggregateClient = ({
  clientSQL,
  usersSQL,
  purposesSQL,
  keysSQL,
}: ClientItemsSQL): WithMetadata<Client> => {
  const users: UserId[] = usersSQL.map((u) => unsafeBrandId(u.userId));
  const purposes: PurposeId[] = purposesSQL.map((p) =>
    unsafeBrandId(p.purposeId)
  );
  const keys: Key[] = keysSQL.map((keySQL) => ({
    userId: unsafeBrandId(keySQL.userId),
    kid: keySQL.kid,
    name: keySQL.name,
    encodedPem: keySQL.encodedPem,
    algorithm: keySQL.algorithm,
    use: KeyUse.parse(keySQL.use),
    createdAt: stringToDate(keySQL.createdAt),
  }));

  return {
    data: {
      id: unsafeBrandId(clientSQL.id),
      consumerId: unsafeBrandId(clientSQL.consumerId),
      name: clientSQL.name,
      purposes,
      ...(clientSQL.description !== null
        ? {
            description: clientSQL.description,
          }
        : {}),
      users,
      kind: ClientKind.parse(clientSQL.kind),
      createdAt: stringToDate(clientSQL.createdAt),
      keys,
    },
    metadata: { version: clientSQL.metadataVersion },
  };
};

export const aggregateClientArray = ({
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
    aggregateClient({
      clientSQL,
      usersSQL: usersSQL.filter((u) => u.clientId === clientSQL.id),
      purposesSQL: purposesSQL.filter((p) => p.clientId === clientSQL.id),
      keysSQL: keysSQL.filter((k) => k.clientId === clientSQL.id),
    })
  );
