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
  usersSQL,
  purposesSQL,
  keysSQL,
}: ClientItemsSQL): WithMetadata<Client> => {
  const users: UserId[] = usersSQL.map((u) => unsafeBrandId<UserId>(u.userId));
  const purposes: PurposeId[] = purposesSQL.map((p) =>
    unsafeBrandId<PurposeId>(p.purposeId)
  );
  const keys: Key[] = keysSQL.map((k) => ({
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

  const userIdSet = new Set<[string, string]>();
  const usersSQL: ClientUserSQL[] = [];

  const purposeIdSet = new Set<[string, string]>();
  const purposesSQL: ClientPurposeSQL[] = [];

  const keyIdSet = new Set<[string, string]>();
  const keysSQL: ClientKeySQL[] = [];

  queryRes.forEach((row) => {
    const clientUserSQL = row.clientUser;
    if (
      clientUserSQL &&
      !userIdSet.has([clientUserSQL.clientId, clientUserSQL.userId])
    ) {
      userIdSet.add([clientUserSQL.clientId, clientUserSQL.userId]);
      // eslint-disable-next-line functional/immutable-data
      usersSQL.push(clientUserSQL);
    }

    const clientPurposeSQL = row.clientPurpose;
    if (
      clientPurposeSQL &&
      !purposeIdSet.has([clientPurposeSQL.clientId, clientPurposeSQL.purposeId])
    ) {
      purposeIdSet.add([clientPurposeSQL.clientId, clientPurposeSQL.purposeId]);
      // eslint-disable-next-line functional/immutable-data
      purposesSQL.push(clientPurposeSQL);
    }

    const clientKeySQL = row.clientKey;
    if (
      clientKeySQL &&
      !keyIdSet.has([clientKeySQL.clientId, clientKeySQL.kid])
    ) {
      keyIdSet.add([clientKeySQL.clientId, clientKeySQL.kid]);
      // eslint-disable-next-line functional/immutable-data
      keysSQL.push(clientKeySQL);
    }
  });

  return {
    clientSQL,
    usersSQL,
    purposesSQL,
    keysSQL,
  };
};
