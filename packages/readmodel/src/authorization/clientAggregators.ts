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

// TODO: ...rest?
export const clientSQLToClient = ({
  clientSQL,
  clientUsersSQL,
  clientPurposesSQL,
  clientKeysSQL,
}: ClientItemsSQL): WithMetadata<Client> => {
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

export const fromJoinToAggregatorClient = (
  queryRes: Array<{
    client: ClientSQL;
    clientUser: ClientUserSQL | null;
    clientPurpose: ClientPurposeSQL | null;
    clientKey: ClientKeySQL | null;
  }>
): ClientItemsSQL => {
  const clientSQL = queryRes[0].client;

  const clientUserIdSet = new Set<[string, string]>();
  const clientUsersSQL: ClientUserSQL[] = [];

  const clientPurposeIdSet = new Set<[string, string]>();
  const clientPurposesSQL: ClientPurposeSQL[] = [];

  const clientKeyIdSet = new Set<[string, string]>();
  const clientKeysSQL: ClientKeySQL[] = [];

  queryRes.forEach((row) => {
    const clientUserSQL = row.clientUser;
    if (
      clientUserSQL &&
      !clientUserIdSet.has([clientUserSQL.clientId, clientUserSQL.userId])
    ) {
      clientUserIdSet.add([clientUserSQL.clientId, clientUserSQL.userId]);
      // eslint-disable-next-line functional/immutable-data
      clientUsersSQL.push(clientUserSQL);
    }

    const clientPurposeSQL = row.clientPurpose;
    if (
      clientPurposeSQL &&
      !clientPurposeIdSet.has([
        clientPurposeSQL.clientId,
        clientPurposeSQL.purposeId,
      ])
    ) {
      clientPurposeIdSet.add([
        clientPurposeSQL.clientId,
        clientPurposeSQL.purposeId,
      ]);
      // eslint-disable-next-line functional/immutable-data
      clientPurposesSQL.push(clientPurposeSQL);
    }

    const clientKeySQL = row.clientKey;
    if (
      clientKeySQL &&
      !clientKeyIdSet.has([clientKeySQL.clientId, clientKeySQL.kid])
    ) {
      clientKeyIdSet.add([clientKeySQL.clientId, clientKeySQL.kid]);
      // eslint-disable-next-line functional/immutable-data
      clientKeysSQL.push(clientKeySQL);
    }
  });

  return {
    clientSQL,
    clientUsersSQL,
    clientPurposesSQL,
    clientKeysSQL,
  };
};
