import {
  EServiceId,
  Key,
  KeyUse,
  ProducerKeychain,
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
}): Array<WithMetadata<ProducerKeychain>> =>
  producerKeychainsSQL.map((producerKeychainSQL) =>
    aggregateProducerKeychain({
      producerKeychainSQL,
      usersSQL: producerKeychainUsersSQL.filter(
        (user) => user.producerKeychainId === producerKeychainSQL.id
      ),
      eservicesSQL: producerKeychainEServicesSQL.filter(
        (eservice) => eservice.producerKeychainId === producerKeychainSQL.id
      ),
      keysSQL: producerKeychainKeysSQL.filter(
        (key) => key.producerKeychainId === producerKeychainSQL.id
      ),
    })
  );

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
    if (
      producerKeychainUserSQL &&
      !userIdSet.has(
        uniqueKey([
          producerKeychainUserSQL.producerKeychainId,
          producerKeychainUserSQL.userId,
        ])
      )
    ) {
      userIdSet.add(
        uniqueKey([
          producerKeychainUserSQL.producerKeychainId,
          producerKeychainUserSQL.userId,
        ])
      );
      // eslint-disable-next-line functional/immutable-data
      usersSQL.push(producerKeychainUserSQL);
    }

    const producerKeychainEserviceSQL = row.producerKeychainEService;
    if (
      producerKeychainEserviceSQL &&
      !eserviceIdSet.has(
        uniqueKey([
          producerKeychainEserviceSQL.producerKeychainId,
          producerKeychainEserviceSQL.eserviceId,
        ])
      )
    ) {
      eserviceIdSet.add(
        uniqueKey([
          producerKeychainEserviceSQL.producerKeychainId,
          producerKeychainEserviceSQL.eserviceId,
        ])
      );
      // eslint-disable-next-line functional/immutable-data
      eservicesSQL.push(producerKeychainEserviceSQL);
    }

    const producerKeychainKeySQL = row.producerKeychainKey;
    if (
      producerKeychainKeySQL &&
      !keyIdSet.has(
        uniqueKey([
          producerKeychainKeySQL.producerKeychainId,
          producerKeychainKeySQL.kid,
        ])
      )
    ) {
      keyIdSet.add(
        uniqueKey([
          producerKeychainKeySQL.producerKeychainId,
          producerKeychainKeySQL.kid,
        ])
      );
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

const uniqueKey = (ids: string[]): string => ids.join("#");
