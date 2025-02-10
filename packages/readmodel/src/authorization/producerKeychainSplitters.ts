import {
  ProducerKeychain,
  ProducerKeychainEServiceSQL,
  ProducerKeychainKeySQL,
  ProducerKeychainSQL,
  ProducerKeychainUserSQL,
} from "pagopa-interop-models";

export const splitProducerKeychainIntoObjectsSQL = (
  {
    id,
    producerId,
    name,
    createdAt,
    eservices,
    description,
    users,
    keys,
    ...rest
  }: ProducerKeychain,
  version: number
): {
  producerKeychainSQL: ProducerKeychainSQL;
  producerKeychainUsersSQL: ProducerKeychainUserSQL[];
  producerKeychainEServicesSQL: ProducerKeychainEServiceSQL[];
  producerKeychainKeysSQL: ProducerKeychainKeySQL[];
} => {
  void (rest satisfies Record<string, never>);

  const producerKeychainSQL: ProducerKeychainSQL = {
    id,
    metadata_version: version,
    producer_id: producerId,
    name,
    created_at: createdAt,
    description,
  };

  const producerKeychainUsersSQL: ProducerKeychainUserSQL[] = users.map(
    (userId) => ({
      metadata_version: version,
      producer_keychain_id: id,
      user_id: userId,
    })
  );

  const producerKeychainEServicesSQL: ProducerKeychainEServiceSQL[] =
    eservices.map((eserviceId) => ({
      metadata_version: version,
      producer_keychain_id: id,
      eservice_id: eserviceId,
    }));

  const producerKeychainKeysSQL: ProducerKeychainKeySQL[] = keys.map((key) => ({
    metadata_version: version,
    producer_keychain_id: id,
    user_id: key.userId,
    kid: key.kid,
    name: key.name,
    encoded_pem: key.encodedPem,
    algorithm: key.algorithm,
    use: key.use,
    created_at: key.createdAt,
  }));

  return {
    producerKeychainSQL,
    producerKeychainUsersSQL,
    producerKeychainEServicesSQL,
    producerKeychainKeysSQL,
  };
};
