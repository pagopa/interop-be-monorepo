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
  producerKeychainSQL: {
    id,
    metadataVersion,
    producerId,
    name,
    createdAt,
    description,
    ...rest
  },
  usersSQL,
  eservicesSQL,
  keysSQL,
}: ProducerKeychainItemsSQL): WithMetadata<ProducerKeychain> => {
  void (rest satisfies Record<string, never>);

  const users: UserId[] = usersSQL.map((u) => unsafeBrandId(u.userId));
  const eservices: EServiceId[] = eservicesSQL.map((e) =>
    unsafeBrandId(e.eserviceId)
  );
  const keys: Key[] = keysSQL.map(
    ({
      userId,
      kid,
      name,
      encodedPem,
      algorithm,
      use,
      createdAt,
      ...keyRest
    }: Omit<
      ProducerKeychainKeySQL,
      "metadataVersion" | "producerKeychainId"
    >) => {
      void (keyRest satisfies Record<string, never>);

      return {
        userId: unsafeBrandId(userId),
        kid,
        name,
        encodedPem,
        algorithm,
        use: KeyUse.parse(use),
        createdAt: stringToDate(createdAt),
      };
    }
  );

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

export const aggregateProducerKeychainArraySQL = ({
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
    aggregateProducerKeychainSQL({
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
