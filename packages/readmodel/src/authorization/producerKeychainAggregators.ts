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

export const aggregateProducerKeychainSQL = ({
  producerKeychainSQL,
  producerKeychainUsersSQL,
  producerKeychainEServicesSQL,
  producerKeychainKeysSQL,
}: ProducerKeychainItemsSQL): WithMetadata<ProducerKeychain> => {
  const users: UserId[] = producerKeychainUsersSQL.map((u) =>
    unsafeBrandId(u.userId)
  );
  const eservices: EServiceId[] = producerKeychainEServicesSQL.map((e) =>
    unsafeBrandId(e.eserviceId)
  );
  const keys: Key[] = producerKeychainKeysSQL.map((k) => ({
    userId: unsafeBrandId(k.userId),
    kid: k.kid,
    name: k.name,
    encodedPem: k.encodedPem,
    algorithm: k.algorithm,
    use: KeyUse.parse(k.use),
    createdAt: stringToDate(k.createdAt),
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

export const aggregateProducerKeychainArraySQL = ({
  producerKeychainsSQL,
  producerKeychainUsersSQL,
  producerKeychainEServicesSQL,
  producerKeychainKeysSQL,
}: {
  producerKeychainsSQL: ProducerKeychainSQL[];
  producerKeychainUsersSQL: ProducerKeychainUserSQL[];
  producerKeychainEServicesSQL: ProducerKeychainEServiceSQL[];
  producerKeychainKeysSQL: ProducerKeychainKeySQL[];
}): Array<WithMetadata<ProducerKeychain>> =>
  producerKeychainsSQL.map((producerKeychainSQL) => {
    const usersSQLOfCurrentKeychain = producerKeychainUsersSQL.filter(
      (user) => user.producerKeychainId === producerKeychainSQL.id
    );

    const eservicesSQLOfCurrentKeychain = producerKeychainEServicesSQL.filter(
      (eservice) => eservice.producerKeychainId === producerKeychainSQL.id
    );

    const keysOfCurrentKeychain = producerKeychainKeysSQL.filter(
      (key) => key.producerKeychainId === producerKeychainSQL.id
    );

    return aggregateProducerKeychainSQL({
      producerKeychainSQL,
      producerKeychainUsersSQL: usersSQLOfCurrentKeychain,
      producerKeychainEServicesSQL: eservicesSQLOfCurrentKeychain,
      producerKeychainKeysSQL: keysOfCurrentKeychain,
    });
  });

export const fromJoinToAggregator = (
  queryRes: Array<{
    producerKeychain: ProducerKeychainSQL;
    producerKeychainUser: ProducerKeychainUserSQL | null;
    producerKeychainEService: ProducerKeychainEServiceSQL | null;
    producerKeychainKey: ProducerKeychainKeySQL | null;
  }>
): ProducerKeychainItemsSQL => {
  const producerKeychainSQL = queryRes[0].producerKeychain;

  const producerKeychainUserIdSet = new Set<[string, string]>();
  const producerKeychainUsersSQL: ProducerKeychainUserSQL[] = [];

  const producerKeychainEServiceIdSet = new Set<[string, string]>();
  const producerKeychainEServicesSQL: ProducerKeychainEServiceSQL[] = [];

  const producerKeychainKeyIdSet = new Set<[string, string]>();
  const producerKeychainKeysSQL: ProducerKeychainKeySQL[] = [];

  queryRes.forEach((row) => {
    const producerKeychainUserSQL = row.producerKeychainUser;
    if (
      producerKeychainUserSQL &&
      !producerKeychainUserIdSet.has([
        producerKeychainUserSQL.producerKeychainId,
        producerKeychainUserSQL.userId,
      ])
    ) {
      producerKeychainUserIdSet.add([
        producerKeychainUserSQL.producerKeychainId,
        producerKeychainUserSQL.userId,
      ]);
      // eslint-disable-next-line functional/immutable-data
      producerKeychainUsersSQL.push(producerKeychainUserSQL);
    }

    const producerKeychainEserviceSQL = row.producerKeychainEService;
    if (
      producerKeychainEserviceSQL &&
      !producerKeychainEServiceIdSet.has([
        producerKeychainEserviceSQL.producerKeychainId,
        producerKeychainEserviceSQL.eserviceId,
      ])
    ) {
      producerKeychainEServiceIdSet.add([
        producerKeychainEserviceSQL.producerKeychainId,
        producerKeychainEserviceSQL.eserviceId,
      ]);
      // eslint-disable-next-line functional/immutable-data
      producerKeychainEServicesSQL.push(producerKeychainEserviceSQL);
    }

    const producerKeychainKeySQL = row.producerKeychainKey;
    if (
      producerKeychainKeySQL &&
      !producerKeychainKeyIdSet.has([
        producerKeychainKeySQL.producerKeychainId,
        producerKeychainKeySQL.kid,
      ])
    ) {
      producerKeychainKeyIdSet.add([
        producerKeychainKeySQL.producerKeychainId,
        producerKeychainKeySQL.kid,
      ]);
      // eslint-disable-next-line functional/immutable-data
      producerKeychainKeysSQL.push(producerKeychainKeySQL);
    }
  });

  return {
    producerKeychainSQL,
    producerKeychainUsersSQL,
    producerKeychainEServicesSQL,
    producerKeychainKeysSQL,
  };
};
