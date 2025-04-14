import {
  Client,
  ClientId,
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
import { makeUniqueKey } from "../utils.js";

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
}): Array<WithMetadata<Client>> => {
  const usersSQLByClientId = createClientSQLPropertyMap(usersSQL);
  const purposesSQLByClientId = createClientSQLPropertyMap(purposesSQL);
  const keysSQLByClientId = createClientSQLPropertyMap(keysSQL);

  return clientsSQL.map((clientSQL) => {
    const clientId = unsafeBrandId<ClientId>(clientSQL.id);
    return aggregateClient({
      clientSQL,
      usersSQL: usersSQLByClientId.get(clientId) || [],
      purposesSQL: purposesSQLByClientId.get(clientId) || [],
      keysSQL: keysSQLByClientId.get(clientId) || [],
    });
  });
};

const createClientSQLPropertyMap = <
  T extends ClientUserSQL | ClientPurposeSQL | ClientKeySQL
>(
  items: T[]
): Map<ClientId, T[]> =>
  items.reduce((acc, item) => {
    const clientId = unsafeBrandId<ClientId>(item.clientId);
    const values = acc.get(clientId) || [];
    // eslint-disable-next-line functional/immutable-data
    values.push(item);
    acc.set(clientId, values);

    return acc;
  }, new Map<ClientId, T[]>());

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

  const userIdSet = new Set<string>();
  const usersSQL: ClientUserSQL[] = [];

  const purposeIdSet = new Set<string>();
  const purposesSQL: ClientPurposeSQL[] = [];

  const keyIdSet = new Set<string>();
  const keysSQL: ClientKeySQL[] = [];

  queryRes.forEach((row) => {
    const clientSQL = row.client;
    if (!clientIdSet.has(clientSQL.id)) {
      clientIdSet.add(clientSQL.id);
      // eslint-disable-next-line functional/immutable-data
      clientsSQL.push(clientSQL);
    }

    const userSQL = row.clientUser;
    if (
      userSQL &&
      !userIdSet.has(makeUniqueKey([userSQL.clientId, userSQL.userId]))
    ) {
      userIdSet.add(makeUniqueKey([userSQL.clientId, userSQL.userId]));
      // eslint-disable-next-line functional/immutable-data
      usersSQL.push(userSQL);
    }

    const purposeSQL = row.clientPurpose;
    if (
      purposeSQL &&
      !purposeIdSet.has(
        makeUniqueKey([purposeSQL.clientId, purposeSQL.purposeId])
      )
    ) {
      purposeIdSet.add(
        makeUniqueKey([purposeSQL.clientId, purposeSQL.purposeId])
      );
      // eslint-disable-next-line functional/immutable-data
      purposesSQL.push(purposeSQL);
    }

    const keySQL = row.clientKey;
    if (keySQL && !keyIdSet.has(makeUniqueKey([keySQL.clientId, keySQL.kid]))) {
      keyIdSet.add(makeUniqueKey([keySQL.clientId, keySQL.kid]));
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
