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

export const aggregateClient = ({
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

export const toClientAggregator = (
  queryRes: Array<{
    client: ClientSQL;
    clientUser: ClientUserSQL | null;
    clientPurpose: ClientPurposeSQL | null;
    clientKey: ClientKeySQL | null;
  }>
): ClientItemsSQL => {
  const { clientsSQL, usersSQL, purposesSQL, keysSQL } =
    toClientAggregatorArray(queryRes);
  return {
    clientSQL: clientsSQL[0],
    usersSQL,
    purposesSQL,
    keysSQL,
  };
};

export const toClientAggregatorArray = (
  queryRes: Array<{
    client: ClientSQL;
    clientUser: ClientUserSQL | null;
    clientPurpose: ClientPurposeSQL | null;
    clientKey: ClientKeySQL | null;
  }>
): {
  clientsSQL: ClientSQL[];
  usersSQL: ClientUserSQL[];
  purposesSQL: ClientPurposeSQL[];
  keysSQL: ClientKeySQL[];
} => {
  const clientIdSet = new Set<string>();
  const clientsSQL: ClientSQL[] = [];

  const userIdSet = new Set<[string, string]>();
  const usersSQL: ClientUserSQL[] = [];

  const purposeIdSet = new Set<[string, string]>();
  const purposesSQL: ClientPurposeSQL[] = [];

  const keyIdSet = new Set<[string, string]>();
  const keysSQL: ClientKeySQL[] = [];

  queryRes.forEach((row) => {
    const clientSQL = row.client;
    if (clientSQL && !clientIdSet.has(clientSQL.id)) {
      clientIdSet.add(clientSQL.id);
      // eslint-disable-next-line functional/immutable-data
      clientsSQL.push(clientSQL);
    }

    const userSQL = row.clientUser;
    if (userSQL && !userIdSet.has([userSQL.clientId, userSQL.userId])) {
      userIdSet.add([userSQL.clientId, userSQL.userId]);
      // eslint-disable-next-line functional/immutable-data
      usersSQL.push(userSQL);
    }

    const purposeSQL = row.clientPurpose;
    if (
      purposeSQL &&
      !purposeIdSet.has([purposeSQL.clientId, purposeSQL.purposeId])
    ) {
      purposeIdSet.add([purposeSQL.clientId, purposeSQL.purposeId]);
      // eslint-disable-next-line functional/immutable-data
      purposesSQL.push(purposeSQL);
    }

    const keySQL = row.clientKey;
    if (keySQL && !keyIdSet.has([keySQL.clientId, keySQL.kid])) {
      keyIdSet.add([keySQL.clientId, keySQL.kid]);
      // eslint-disable-next-line functional/immutable-data
      keysSQL.push(keySQL);
    }
  });

  return {
    clientsSQL,
    usersSQL,
    purposesSQL,
    keysSQL,
  };
};
