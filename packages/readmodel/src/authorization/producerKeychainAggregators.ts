import {
  EServiceId,
  Key,
  ProducerKeychain,
  ProducerKeychainEServiceSQL,
  ProducerKeychainKeySQL,
  ProducerKeychainSQL,
  ProducerKeychainUserSQL,
  UserId,
  WithMetadata,
} from "pagopa-interop-models";

export const producerKeychainSQLToProducerKeychain = (
  {
    id,
    metadata_version,
    producer_id,
    name,
    created_at,
    description,
    ...rest
  }: ProducerKeychainSQL,
  producerKeychainUsersSQL: ProducerKeychainUserSQL[],
  producerKeychainEServicesSQL: ProducerKeychainEServiceSQL[],
  producerKeychainKeysSQL: ProducerKeychainKeySQL[]
): WithMetadata<ProducerKeychain> => {
  void (rest satisfies Record<string, never>);

  const users: UserId[] = producerKeychainUsersSQL.map((u) => u.user_id);
  const eservices: EServiceId[] = producerKeychainEServicesSQL.map(
    (e) => e.eservice_id
  );
  const keys: Key[] = producerKeychainKeysSQL.map((k) => ({
    userId: k.user_id,
    kid: k.kid,
    name: k.name,
    encodedPem: k.encoded_pem,
    algorithm: k.algorithm,
    use: k.use,
    createdAt: k.created_at,
  }));

  return {
    data: {
      id,
      producerId: producer_id,
      name,
      eservices,
      description,
      users,
      createdAt: created_at,
      keys,
    },
    metadata: { version: metadata_version },
  };
};
