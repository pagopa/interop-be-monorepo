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

export const fromJoinToAggregator = (
  queryRes: Array<{
    producerKeychain: ProducerKeychainSQL;
    user: ProducerKeychainUserSQL | null;
    eservice: ProducerKeychainEServiceSQL | null;
    key: ProducerKeychainKeySQL | null;
  }>
): ProducerKeychainItemsSQL => {
  const producerKeychainSQL = queryRes[0].producerKeychain;

  const userIdSet = new Set<[string, string]>();
  const usersSQL: ProducerKeychainUserSQL[] = [];

  const eserviceIdSet = new Set<[string, string]>();
  const eservicesSQL: ProducerKeychainEServiceSQL[] = [];

  const keyIdSet = new Set<[string, string]>();
  const keysSQL: ProducerKeychainKeySQL[] = [];

  queryRes.forEach((row) => {
    const producerKeychainUserSQL = row.user;
    if (
      producerKeychainUserSQL &&
      !userIdSet.has([
        producerKeychainUserSQL.producerKeychainId,
        producerKeychainUserSQL.userId,
      ])
    ) {
      userIdSet.add([
        producerKeychainUserSQL.producerKeychainId,
        producerKeychainUserSQL.userId,
      ]);
      // eslint-disable-next-line functional/immutable-data
      usersSQL.push(producerKeychainUserSQL);
    }

    const producerKeychainEserviceSQL = row.eservice;
    if (
      producerKeychainEserviceSQL &&
      !eserviceIdSet.has([
        producerKeychainEserviceSQL.producerKeychainId,
        producerKeychainEserviceSQL.eserviceId,
      ])
    ) {
      eserviceIdSet.add([
        producerKeychainEserviceSQL.producerKeychainId,
        producerKeychainEserviceSQL.eserviceId,
      ]);
      // eslint-disable-next-line functional/immutable-data
      eservicesSQL.push(producerKeychainEserviceSQL);
    }

    const producerKeychainKeySQL = row.key;
    if (
      producerKeychainKeySQL &&
      !keyIdSet.has([
        producerKeychainKeySQL.producerKeychainId,
        producerKeychainKeySQL.kid,
      ])
    ) {
      keyIdSet.add([
        producerKeychainKeySQL.producerKeychainId,
        producerKeychainKeySQL.kid,
      ]);
      // eslint-disable-next-line functional/immutable-data
      keysSQL.push(producerKeychainKeySQL);
    }
  });

  return {
    producerKeychainSQL,
    usersSQL,
    eservicesSQL,
    keysSQL,
  };
};
