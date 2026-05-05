import {
  EServiceId,
  Key,
  KeyUse,
  ProducerKeychain,
  ProducerKeychainId,
  stringToDate,
  unsafeBrandId,
  UserId,
  WithMetadata,
} from "pagopa-interop-models";
import {
  ProducerKeychainSQL,
  ProducerKeychainUserSQL,
  ProducerKeychainEServiceSQL,
  ProducerKeychainKeySQL,
  ProducerKeychainItemsSQL,
} from "pagopa-interop-readmodel-models";
import { makeUniqueKey, throwIfMultiple } from "../utils.js";

export const aggregateProducerKeychain = ({
  producerKeychainSQL,
  usersSQL,
  eservicesSQL,
  keysSQL,
}: ProducerKeychainItemsSQL): WithMetadata<ProducerKeychain> => {
  const users: UserId[] = usersSQL.map((u) => unsafeBrandId(u.userId));
  const eservices: EServiceId[] = eservicesSQL.map((e) =>
    unsafeBrandId(e.eserviceId)
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
      id: unsafeBrandId(producerKeychainSQL.id),
      producerId: unsafeBrandId(producerKeychainSQL.producerId),
      name: producerKeychainSQL.name,
      eservices,
      description: producerKeychainSQL.description,
      users,
      createdAt: stringToDate(producerKeychainSQL.createdAt),
      keys,
    },
    metadata: { version: producerKeychainSQL.metadataVersion },
  };
};

export const aggregateProducerKeychainArray = ({
  producerKeychainsSQL,
  usersSQL: producerKeychainUsersSQL,
  eservicesSQL: producerKeychainEServicesSQL,
  keysSQL: producerKeychainKeysSQL,
}: {
  producerKeychainsSQL: ProducerKeychainSQL[];
  usersSQL: ProducerKeychainUserSQL[];
  eservicesSQL: ProducerKeychainEServiceSQL[];
  keysSQL: ProducerKeychainKeySQL[];
}): Array<WithMetadata<ProducerKeychain>> => {
  const usersSQLByProducerKeychainId = createProducerKeychainSQLPropertyMap(
    producerKeychainUsersSQL
  );
  const eservicesSQLByProducerKeychainId = createProducerKeychainSQLPropertyMap(
    producerKeychainEServicesSQL
  );
  const keysSQLByProducerKeychainId = createProducerKeychainSQLPropertyMap(
    producerKeychainKeysSQL
  );

  return producerKeychainsSQL.map((producerKeychainSQL) => {
    const producerKeychainId = unsafeBrandId<ProducerKeychainId>(
      producerKeychainSQL.id
    );
    return aggregateProducerKeychain({
      producerKeychainSQL,
      usersSQL: usersSQLByProducerKeychainId.get(producerKeychainId) || [],
      eservicesSQL:
        eservicesSQLByProducerKeychainId.get(producerKeychainId) || [],
      keysSQL: keysSQLByProducerKeychainId.get(producerKeychainId) || [],
    });
  });
};

const createProducerKeychainSQLPropertyMap = <
  T extends
    | ProducerKeychainUserSQL
    | ProducerKeychainEServiceSQL
    | ProducerKeychainKeySQL,
>(
  items: T[]
): Map<ProducerKeychainId, T[]> =>
  items.reduce((acc, item) => {
    const producerKeychainId = unsafeBrandId<ProducerKeychainId>(
      item.producerKeychainId
    );
    const values = acc.get(producerKeychainId) || [];
    // eslint-disable-next-line functional/immutable-data
    values.push(item);
    acc.set(producerKeychainId, values);

    return acc;
  }, new Map<ProducerKeychainId, T[]>());

export const toProducerKeychainAggregator = (
  queryRes: Array<{
    producerKeychain: ProducerKeychainSQL;
    producerKeychainUser: ProducerKeychainUserSQL | null;
    producerKeychainEService: ProducerKeychainEServiceSQL | null;
    producerKeychainKey: ProducerKeychainKeySQL | null;
  }>
): ProducerKeychainItemsSQL => {
  const { producerKeychainsSQL, usersSQL, eservicesSQL, keysSQL } =
    toProducerKeychainAggregatorArray(queryRes);

  throwIfMultiple(producerKeychainsSQL, "producer keychain");

  return {
    producerKeychainSQL: producerKeychainsSQL[0],
    usersSQL,
    eservicesSQL,
    keysSQL,
  };
};

export const toProducerKeychainAggregatorArray = (
  queryRes: Array<{
    producerKeychain: ProducerKeychainSQL;
    producerKeychainUser: ProducerKeychainUserSQL | null;
    producerKeychainEService: ProducerKeychainEServiceSQL | null;
    producerKeychainKey: ProducerKeychainKeySQL | null;
  }>
): {
  producerKeychainsSQL: ProducerKeychainSQL[];
  usersSQL: ProducerKeychainUserSQL[];
  eservicesSQL: ProducerKeychainEServiceSQL[];
  keysSQL: ProducerKeychainKeySQL[];
} => {
  const producerKeychainIdSet = new Set<string>();
  const producerKeychainsSQL: ProducerKeychainSQL[] = [];

  const userIdSet = new Set<string>();
  const usersSQL: ProducerKeychainUserSQL[] = [];

  const eserviceIdSet = new Set<string>();
  const eservicesSQL: ProducerKeychainEServiceSQL[] = [];

  const keyIdSet = new Set<string>();
  const keysSQL: ProducerKeychainKeySQL[] = [];

  queryRes.forEach((row) => {
    const producerKeychain = row.producerKeychain;
    if (!producerKeychainIdSet.has(producerKeychain.id)) {
      producerKeychainIdSet.add(producerKeychain.id);
      // eslint-disable-next-line functional/immutable-data
      producerKeychainsSQL.push(producerKeychain);
    }

    const producerKeychainUserSQL = row.producerKeychainUser;
    const producerKeychainUserPK = producerKeychainUserSQL
      ? makeUniqueKey([
          producerKeychainUserSQL.producerKeychainId,
          producerKeychainUserSQL.userId,
        ])
      : undefined;
    if (
      producerKeychainUserSQL &&
      producerKeychainUserPK &&
      !userIdSet.has(producerKeychainUserPK)
    ) {
      userIdSet.add(producerKeychainUserPK);
      // eslint-disable-next-line functional/immutable-data
      usersSQL.push(producerKeychainUserSQL);
    }

    const producerKeychainEserviceSQL = row.producerKeychainEService;
    const producerKeychainEservicePK = producerKeychainEserviceSQL
      ? makeUniqueKey([
          producerKeychainEserviceSQL.producerKeychainId,
          producerKeychainEserviceSQL.eserviceId,
        ])
      : undefined;
    if (
      producerKeychainEserviceSQL &&
      producerKeychainEservicePK &&
      !eserviceIdSet.has(producerKeychainEservicePK)
    ) {
      eserviceIdSet.add(producerKeychainEservicePK);
      // eslint-disable-next-line functional/immutable-data
      eservicesSQL.push(producerKeychainEserviceSQL);
    }

    const producerKeychainKeySQL = row.producerKeychainKey;
    const producerKeychainKeyPK = producerKeychainKeySQL
      ? makeUniqueKey([
          producerKeychainKeySQL.producerKeychainId,
          producerKeychainKeySQL.kid,
        ])
      : undefined;
    if (
      producerKeychainKeySQL &&
      producerKeychainKeyPK &&
      !keyIdSet.has(producerKeychainKeyPK)
    ) {
      keyIdSet.add(producerKeychainKeyPK);
      // eslint-disable-next-line functional/immutable-data
      keysSQL.push(producerKeychainKeySQL);
    }
  });

  return {
    producerKeychainsSQL,
    usersSQL,
    eservicesSQL,
    keysSQL,
  };
};
