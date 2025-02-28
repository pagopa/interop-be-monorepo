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
