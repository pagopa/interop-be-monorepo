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

  const usersSQL: ProducerKeychainUserSQL[] = users.map((userId) => ({
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
