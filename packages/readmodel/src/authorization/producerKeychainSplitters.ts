import { ProducerKeychainReadModel } from "pagopa-interop-models";
import {
  ProducerKeychainSQL,
  ProducerKeychainEServiceSQL,
  ProducerKeychainKeySQL,
  ProducerKeychainUserSQL,
} from "../types.js";

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
  }: ProducerKeychainReadModel,
  metadataVersion: number
): {
  producerKeychainSQL: ProducerKeychainSQL;
  producerKeychainUsersSQL: ProducerKeychainUserSQL[];
  producerKeychainEServicesSQL: ProducerKeychainEServiceSQL[];
  producerKeychainKeysSQL: ProducerKeychainKeySQL[];
} => {
  void (rest satisfies Record<string, never>);

  const producerKeychainSQL: ProducerKeychainSQL = {
    id,
    metadataVersion,
    producerId,
    name,
    createdAt,
    description,
  };

  const producerKeychainUsersSQL: ProducerKeychainUserSQL[] = users.map(
    (userId) => ({
      metadataVersion,
      producerKeychainId: id,
      userId,
    })
  );

  const producerKeychainEServicesSQL: ProducerKeychainEServiceSQL[] =
    eservices.map((eserviceId) => ({
      metadataVersion,
      producerKeychainId: id,
      eserviceId,
    }));

  const producerKeychainKeysSQL: ProducerKeychainKeySQL[] = keys.map((key) => ({
    metadataVersion,
    producerKeychainId: id,
    userId: key.userId,
    kid: key.kid,
    name: key.name,
    encodedPem: key.encodedPem,
    algorithm: key.algorithm,
    use: key.use,
    createdAt: key.createdAt,
  }));

  return {
    producerKeychainSQL,
    producerKeychainUsersSQL,
    producerKeychainEServicesSQL,
    producerKeychainKeysSQL,
  };
};
