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
} from "pagopa-interop-readmodel-models";

export const producerKeychainSQLToProducerKeychain = (
  {
    id,
    metadataVersion,
    producerId,
    name,
    createdAt,
    description,
    ...rest
  }: ProducerKeychainSQL,
  producerKeychainUsersSQL: ProducerKeychainUserSQL[],
  producerKeychainEServicesSQL: ProducerKeychainEServiceSQL[],
  producerKeychainKeysSQL: ProducerKeychainKeySQL[]
): WithMetadata<ProducerKeychain> => {
  void (rest satisfies Record<string, never>);

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
      id: unsafeBrandId(id),
      producerId: unsafeBrandId(producerId),
      name,
      eservices,
      description,
      users,
      createdAt: stringToDate(createdAt),
      keys,
    },
    metadata: { version: metadataVersion },
  };
};
