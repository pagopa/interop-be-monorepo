import { dateToString, ProducerKeychain } from "pagopa-interop-models";
import {
  ProducerKeychainSQL,
  ProducerKeychainEServiceSQL,
  ProducerKeychainKeySQL,
  ProducerKeychainUserSQL,
  ProducerKeychainItemsSQL,
} from "pagopa-interop-readmodel-models";

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
  metadataVersion: number
): ProducerKeychainItemsSQL => {
  void (rest satisfies Record<string, never>);

  const producerKeychainSQL: ProducerKeychainSQL = {
    id,
    metadataVersion,
    producerId,
    name,
    createdAt: dateToString(createdAt),
    description,
  };

  // Get only the unique users to prevent the consumer from crashing on legacy messages
  // The check will also be applied upstream in the process, but this is just for pre-existing messages
  const uniqueUsers = [...new Set(users)];

  const usersSQL: ProducerKeychainUserSQL[] = uniqueUsers.map((userId) => ({
    metadataVersion,
    producerKeychainId: id,
    userId,
  }));

  const eservicesSQL: ProducerKeychainEServiceSQL[] = eservices.map(
    (eserviceId) => ({
      metadataVersion,
      producerKeychainId: id,
      eserviceId,
    })
  );

  const keysSQL: ProducerKeychainKeySQL[] = keys.map(
    ({
      userId,
      kid,
      name,
      encodedPem,
      algorithm,
      use,
      createdAt,
      ...keyRest
    }) => {
      void (keyRest satisfies Record<string, never>);

      return {
        metadataVersion,
        producerKeychainId: id,
        userId,
        kid,
        name,
        encodedPem,
        algorithm,
        use,
        createdAt: dateToString(createdAt),
      };
    }
  );

  return {
    producerKeychainSQL,
    usersSQL,
    eservicesSQL,
    keysSQL,
  };
};
