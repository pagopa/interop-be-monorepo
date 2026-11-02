import {
  DeleteItemCommand,
  DeleteItemInput,
  DynamoDBClient,
  GetItemCommand,
  GetItemInput,
  PutItemCommand,
  PutItemInput,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { Logger } from "pagopa-interop-commons";
import {
  EServiceId,
  genericInternalError,
  Key,
  makeProducerKeychainPlatformStatesPK,
  ProducerKeychain,
  ProducerKeychainId,
  ProducerKeychainPlatformStatesPK,
  TenantId,
} from "pagopa-interop-models";

export type ProducerKeychainPlatformStateEntry = {
  PK: ProducerKeychainPlatformStatesPK;
  publicKey: string;
  producerKeychainId: ProducerKeychainId;
  producerId: TenantId;
  kid: string;
  eServiceId: EServiceId;
  version: number;
  updatedAt: string;
};

const readProducerKeychainPlatformStateEntryByPK = async ({
  dynamoDBClient,
  tableName,
  pk,
}: {
  dynamoDBClient: DynamoDBClient;
  tableName: string;
  pk: ProducerKeychainPlatformStatesPK;
}): Promise<ProducerKeychainPlatformStateEntry | undefined> => {
  const input: GetItemInput = {
    Key: {
      PK: { S: pk },
    },
    TableName: tableName,
    ConsistentRead: true,
  };

  const data = await dynamoDBClient.send(new GetItemCommand(input));

  if (!data.Item) {
    return undefined;
  }

  const unmarshalled = unmarshall(data.Item);

  if (
    typeof unmarshalled.PK !== "string" ||
    typeof unmarshalled.version !== "number"
  ) {
    throw genericInternalError(
      `Unable to parse producer-keychain platform-state entry: ${JSON.stringify(
        data.Item
      )}`
    );
  }

  return unmarshalled as ProducerKeychainPlatformStateEntry;
};

const upsertProducerKeychainPlatformStateEntry = async ({
  producerKeychainId,
  producerId,
  key,
  eServiceId,
  version,
  dynamoDBClient,
  tableName,
  logger,
}: {
  producerKeychainId: ProducerKeychainId;
  producerId: TenantId;
  key: Key;
  eServiceId: EServiceId;
  version: number;
  dynamoDBClient: DynamoDBClient;
  tableName: string;
  logger: Logger;
}): Promise<void> => {
  const pk = makeProducerKeychainPlatformStatesPK({
    producerKeychainId,
    kid: key.kid,
    eServiceId,
  });

  const existing = await readProducerKeychainPlatformStateEntryByPK({
    dynamoDBClient,
    tableName,
    pk,
  });

  if (existing && existing.version > version) {
    logger.info(
      `Skipping processing of entry ${pk}. Reason: a more recent entry already exists`
    );
    return;
  }

  const input: PutItemInput = {
    TableName: tableName,
    Item: {
      PK: { S: pk },
      publicKey: { S: key.encodedPem },
      producerKeychainId: { S: producerKeychainId },
      producerId: { S: producerId },
      kid: { S: key.kid },
      eServiceId: { S: eServiceId },
      version: { N: version.toString() },
      updatedAt: { S: new Date().toISOString() },
    },
  };

  await dynamoDBClient.send(new PutItemCommand(input));
  logger.info(`Producer-keychain-platform-states. Upserted entry ${pk}`);
};

const deleteProducerKeychainPlatformStateEntry = async ({
  pk,
  version,
  dynamoDBClient,
  tableName,
  logger,
}: {
  pk: ProducerKeychainPlatformStatesPK;
  version: number;
  dynamoDBClient: DynamoDBClient;
  tableName: string;
  logger: Logger;
}): Promise<void> => {
  const existing = await readProducerKeychainPlatformStateEntryByPK({
    dynamoDBClient,
    tableName,
    pk,
  });

  if (!existing) {
    logger.info(
      `Skipping delete of entry ${pk}. Reason: entry not found in producer-keychain-platform-states`
    );
    return;
  }

  if (existing.version > version) {
    logger.info(
      `Skipping delete of entry ${pk}. Reason: a more recent entry already exists`
    );
    return;
  }

  const input: DeleteItemInput = {
    Key: {
      PK: { S: pk },
    },
    TableName: tableName,
  };

  await dynamoDBClient.send(new DeleteItemCommand(input));
  logger.info(`Producer-keychain-platform-states. Deleted entry ${pk}`);
};

export const upsertAllProducerKeychainPlatformStatesEntries = async ({
  producerKeychain,
  version,
  dynamoDBClient,
  tableName,
  logger,
}: {
  producerKeychain: ProducerKeychain;
  version: number;
  dynamoDBClient: DynamoDBClient;
  tableName: string;
  logger: Logger;
}): Promise<void> => {
  await Promise.all(
    producerKeychain.keys.flatMap((key) =>
      producerKeychain.eservices.map(async (eServiceId) => {
        await upsertProducerKeychainPlatformStateEntry({
          producerKeychainId: producerKeychain.id,
          producerId: producerKeychain.producerId,
          key,
          eServiceId,
          version,
          dynamoDBClient,
          tableName,
          logger,
        });
      })
    )
  );
};

export const upsertProducerKeychainPlatformStatesEntriesByEServiceId = async ({
  producerKeychainId,
  producerId,
  eServiceId,
  keys,
  version,
  dynamoDBClient,
  tableName,
  logger,
}: {
  producerKeychainId: ProducerKeychainId;
  producerId: TenantId;
  eServiceId: EServiceId;
  keys: Key[];
  version: number;
  dynamoDBClient: DynamoDBClient;
  tableName: string;
  logger: Logger;
}): Promise<void> => {
  await Promise.all(
    keys.map(async (key) => {
      await upsertProducerKeychainPlatformStateEntry({
        producerKeychainId,
        producerId,
        key,
        eServiceId,
        version,
        dynamoDBClient,
        tableName,
        logger,
      });
    })
  );
};

export const upsertProducerKeychainPlatformStatesEntriesByKid = async ({
  producerKeychainId,
  producerId,
  kid,
  keys,
  eServiceIds,
  version,
  dynamoDBClient,
  tableName,
  logger,
}: {
  producerKeychainId: ProducerKeychainId;
  producerId: TenantId;
  kid: string;
  keys: Key[];
  eServiceIds: EServiceId[];
  version: number;
  dynamoDBClient: DynamoDBClient;
  tableName: string;
  logger: Logger;
}): Promise<void> => {
  const key = keys.find((currentKey) => currentKey.kid === kid);
  if (!key) {
    logger.info(
      `Skipping upsert of entries for kid ${kid}. Reason: key not found in producer keychain`
    );
    return;
  }

  await Promise.all(
    eServiceIds.map(async (eServiceId) => {
      await upsertProducerKeychainPlatformStateEntry({
        producerKeychainId,
        producerId,
        key,
        eServiceId,
        version,
        dynamoDBClient,
        tableName,
        logger,
      });
    })
  );
};

export const deleteProducerKeychainPlatformStatesEntriesByKid = async ({
  producerKeychainId,
  kid,
  eServiceIds,
  version,
  dynamoDBClient,
  tableName,
  logger,
}: {
  producerKeychainId: ProducerKeychainId;
  kid: string;
  eServiceIds: EServiceId[];
  version: number;
  dynamoDBClient: DynamoDBClient;
  tableName: string;
  logger: Logger;
}): Promise<void> => {
  await Promise.all(
    eServiceIds.map(async (eServiceId) => {
      await deleteProducerKeychainPlatformStateEntry({
        pk: makeProducerKeychainPlatformStatesPK({
          producerKeychainId,
          kid,
          eServiceId,
        }),
        version,
        dynamoDBClient,
        tableName,
        logger,
      });
    })
  );
};

export const deleteProducerKeychainPlatformStatesEntriesByEServiceId = async ({
  producerKeychainId,
  eServiceId,
  kids,
  version,
  dynamoDBClient,
  tableName,
  logger,
}: {
  producerKeychainId: ProducerKeychainId;
  eServiceId: EServiceId;
  kids: string[];
  version: number;
  dynamoDBClient: DynamoDBClient;
  tableName: string;
  logger: Logger;
}): Promise<void> => {
  await Promise.all(
    kids.map(async (kid) => {
      await deleteProducerKeychainPlatformStateEntry({
        pk: makeProducerKeychainPlatformStatesPK({
          producerKeychainId,
          kid,
          eServiceId,
        }),
        version,
        dynamoDBClient,
        tableName,
        logger,
      });
    })
  );
};

export const deleteAllProducerKeychainPlatformStatesEntries = async ({
  producerKeychain,
  version,
  dynamoDBClient,
  tableName,
  logger,
}: {
  producerKeychain: ProducerKeychain;
  version: number;
  dynamoDBClient: DynamoDBClient;
  tableName: string;
  logger: Logger;
}): Promise<void> => {
  await Promise.all(
    producerKeychain.keys.flatMap((key) =>
      producerKeychain.eservices.map(async (eServiceId) => {
        await deleteProducerKeychainPlatformStateEntry({
          pk: makeProducerKeychainPlatformStatesPK({
            producerKeychainId: producerKeychain.id,
            kid: key.kid,
            eServiceId,
          }),
          version,
          dynamoDBClient,
          tableName,
          logger,
        });
      })
    )
  );
};
