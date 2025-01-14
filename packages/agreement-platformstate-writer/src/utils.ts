import {
  AgreementId,
  agreementState,
  AgreementState,
  genericInternalError,
  GSIPKConsumerIdEServiceId,
  GSIPKEServiceIdDescriptorId,
  itemState,
  ItemState,
  PlatformStatesAgreementEntry,
  PlatformStatesAgreementPK,
  PlatformStatesCatalogEntry,
  PlatformStatesEServiceDescriptorPK,
  PlatformStatesAgreementGSIAgreement,
  TokenGenStatesConsumerClientGSIAgreement,
  Agreement,
  makePlatformStatesEServiceDescriptorPK,
  makeGSIPKEServiceIdDescriptorId,
  makeGSIPKConsumerIdEServiceId,
} from "pagopa-interop-models";
import {
  AttributeValue,
  DeleteItemCommand,
  DeleteItemInput,
  DynamoDBClient,
  GetItemCommand,
  GetItemCommandOutput,
  GetItemInput,
  PutItemCommand,
  PutItemInput,
  QueryCommand,
  QueryCommandOutput,
  QueryInput,
  UpdateItemCommand,
  UpdateItemInput,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { z } from "zod";
import { Logger } from "pagopa-interop-commons";
import { config } from "./config/config.js";

export const writeAgreementEntry = async (
  agreementEntry: PlatformStatesAgreementEntry,
  dynamoDBClient: DynamoDBClient,
  logger: Logger
): Promise<void> => {
  const input: PutItemInput = {
    ConditionExpression: "attribute_not_exists(PK)",
    Item: {
      PK: {
        S: agreementEntry.PK,
      },
      state: {
        S: agreementEntry.state,
      },
      version: {
        N: agreementEntry.version.toString(),
      },
      updatedAt: {
        S: agreementEntry.updatedAt,
      },
      GSIPK_consumerId_eserviceId: {
        S: agreementEntry.GSIPK_consumerId_eserviceId,
      },
      GSISK_agreementTimestamp: {
        S: agreementEntry.GSISK_agreementTimestamp,
      },
      agreementDescriptorId: {
        S: agreementEntry.agreementDescriptorId,
      },
    },
    TableName: config.tokenGenerationReadModelTableNamePlatform,
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
  logger.info(`Platform-states. Written agreement entry ${agreementEntry.PK}`);
};

export const readAgreementEntry = async (
  primaryKey: PlatformStatesAgreementPK,
  dynamoDBClient: DynamoDBClient
): Promise<PlatformStatesAgreementEntry | undefined> => {
  const input: GetItemInput = {
    Key: {
      PK: { S: primaryKey },
    },
    TableName: config.tokenGenerationReadModelTableNamePlatform,
    ConsistentRead: true,
  };
  const command = new GetItemCommand(input);
  const data: GetItemCommandOutput = await dynamoDBClient.send(command);

  if (!data.Item) {
    return undefined;
  } else {
    const unmarshalled = unmarshall(data.Item);
    const agreementEntry = PlatformStatesAgreementEntry.safeParse(unmarshalled);

    if (!agreementEntry.success) {
      throw genericInternalError(
        `Unable to parse platform-states agreement entry: result ${JSON.stringify(
          agreementEntry
        )} - data ${JSON.stringify(data)} `
      );
    }
    return agreementEntry.data;
  }
};

export const deleteAgreementEntry = async (
  primaryKey: PlatformStatesAgreementPK,
  dynamoDBClient: DynamoDBClient,
  logger: Logger
): Promise<void> => {
  const input: DeleteItemInput = {
    Key: {
      PK: { S: primaryKey },
    },
    TableName: config.tokenGenerationReadModelTableNamePlatform,
  };
  const command = new DeleteItemCommand(input);
  await dynamoDBClient.send(command);
  logger.info(`Platform-states. Deleted agreement entry ${primaryKey}`);
};

export const updateAgreementStateInPlatformStatesEntry = async (
  dynamoDBClient: DynamoDBClient,
  primaryKey: PlatformStatesAgreementPK,
  state: ItemState,
  version: number,
  logger: Logger
): Promise<void> => {
  const input: UpdateItemInput = {
    ConditionExpression: "attribute_exists(PK)",
    Key: {
      PK: {
        S: primaryKey,
      },
    },
    ExpressionAttributeValues: {
      ":newState": {
        S: state,
      },
      ":newVersion": {
        N: version.toString(),
      },
      ":newUpdatedAt": {
        S: new Date().toISOString(),
      },
    },
    ExpressionAttributeNames: {
      "#state": "state",
    },
    UpdateExpression:
      "SET #state = :newState, version = :newVersion, updatedAt = :newUpdatedAt",
    TableName: config.tokenGenerationReadModelTableNamePlatform,
    ReturnValues: "NONE",
  };
  const command = new UpdateItemCommand(input);
  await dynamoDBClient.send(command);
  logger.info(
    `Platform-states. Updated agreement state in entry ${primaryKey}`
  );
};

export const agreementStateToItemState = (state: AgreementState): ItemState =>
  state === agreementState.active ? itemState.active : itemState.inactive;

export const updateAgreementStateOnTokenGenStatesEntries = async ({
  entriesToUpdate,
  agreementState,
  dynamoDBClient,
  logger,
}: {
  entriesToUpdate: TokenGenStatesConsumerClientGSIAgreement[];
  agreementState: AgreementState;
  dynamoDBClient: DynamoDBClient;
  logger: Logger;
}): Promise<void> => {
  for (const entry of entriesToUpdate) {
    const input: UpdateItemInput = {
      // ConditionExpression to avoid upsert
      ConditionExpression: "attribute_exists(PK)",
      Key: {
        PK: {
          S: entry.PK,
        },
      },
      ExpressionAttributeValues: {
        ":newState": {
          S: agreementStateToItemState(agreementState),
        },
        ":newUpdatedAt": {
          S: new Date().toISOString(),
        },
      },
      UpdateExpression:
        "SET agreementState = :newState, updatedAt = :newUpdatedAt",
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      ReturnValues: "NONE",
    };
    const command = new UpdateItemCommand(input);
    await dynamoDBClient.send(command);
    logger.info(
      `Token-generation-states. Updated agreement state in entry ${entry.PK}`
    );
  }
};

export const updateAgreementStateAndDescriptorInfoOnTokenGenStatesEntries =
  async ({
    entriesToUpdate,
    agreementId,
    agreementState,
    dynamoDBClient,
    GSIPK_eserviceId_descriptorId,
    catalogEntry,
    logger,
  }: {
    entriesToUpdate: TokenGenStatesConsumerClientGSIAgreement[];
    agreementId: AgreementId;
    agreementState: AgreementState;
    dynamoDBClient: DynamoDBClient;
    GSIPK_eserviceId_descriptorId: GSIPKEServiceIdDescriptorId;
    catalogEntry: PlatformStatesCatalogEntry | undefined;
    logger: Logger;
  }): Promise<void> => {
    for (const entry of entriesToUpdate) {
      const additionalDescriptorInfo =
        catalogEntry &&
        (!entry.descriptorState ||
          !entry.descriptorAudience ||
          !entry.descriptorVoucherLifespan);

      if (additionalDescriptorInfo) {
        logger.info(
          `Adding descriptor info to token-generation-states entry with PK ${entry.PK} and GSIPK_eserviceId_descriptorId ${GSIPK_eserviceId_descriptorId}`
        );
      }
      const additionalAttributesToSet: Record<string, AttributeValue> =
        additionalDescriptorInfo
          ? {
              ":descriptorState": {
                S: catalogEntry.state,
              },
              ":descriptorAudience": {
                L: catalogEntry.descriptorAudience.map((item) => ({
                  S: item,
                })),
              },
              ":descriptorVoucherLifespan": {
                N: catalogEntry.descriptorVoucherLifespan.toString(),
              },
            }
          : {};
      const input: UpdateItemInput = {
        // ConditionExpression to avoid upsert
        ConditionExpression: "attribute_exists(PK)",
        Key: {
          PK: {
            S: entry.PK,
          },
        },
        ExpressionAttributeValues: {
          ":agreementId": {
            S: agreementId,
          },
          ":gsiEServiceIdDescriptorId": {
            S: GSIPK_eserviceId_descriptorId,
          },
          ":newState": {
            S: agreementStateToItemState(agreementState),
          },
          ":newUpdatedAt": {
            S: new Date().toISOString(),
          },
          ...additionalAttributesToSet,
        },
        UpdateExpression:
          "SET agreementId = :agreementId, agreementState = :newState, GSIPK_eserviceId_descriptorId = :gsiEServiceIdDescriptorId, updatedAt = :newUpdatedAt".concat(
            additionalDescriptorInfo
              ? ", descriptorState = :descriptorState, descriptorAudience = :descriptorAudience, descriptorVoucherLifespan = :descriptorVoucherLifespan"
              : ""
          ),
        TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
        ReturnValues: "NONE",
      };
      const command = new UpdateItemCommand(input);
      await dynamoDBClient.send(command);
      logger.info(
        `Token-generation-states. Updated agreement state and descriptor info in entry ${entry.PK}`
      );
    }
  };

export const readPlatformStateAgreementEntriesByConsumerIdEserviceId = async (
  consumerId_eserviceId: GSIPKConsumerIdEServiceId,
  dynamoDBClient: DynamoDBClient
): Promise<PlatformStatesAgreementGSIAgreement[]> => {
  const runPaginatedQuery = async (
    consumerId_eserviceId: GSIPKConsumerIdEServiceId,
    dynamoDBClient: DynamoDBClient,
    exclusiveStartKey?: Record<string, AttributeValue>
  ): Promise<PlatformStatesAgreementGSIAgreement[]> => {
    const input: QueryInput = {
      TableName: config.tokenGenerationReadModelTableNamePlatform,
      IndexName: "Agreement",
      KeyConditionExpression: `GSIPK_consumerId_eserviceId = :gsiValue`,
      ExpressionAttributeValues: {
        ":gsiValue": { S: consumerId_eserviceId },
      },
      ExclusiveStartKey: exclusiveStartKey,
      ScanIndexForward: false,
    };
    const command = new QueryCommand(input);
    const data: QueryCommandOutput = await dynamoDBClient.send(command);

    if (!data.Items) {
      throw genericInternalError(
        `Unable to read platform-states agreement entries: result ${JSON.stringify(
          data
        )} `
      );
    } else {
      const unmarshalledItems = data.Items.map((item) => unmarshall(item));

      const agreementEntries = z
        .array(PlatformStatesAgreementGSIAgreement)
        .safeParse(unmarshalledItems);

      if (!agreementEntries.success) {
        throw genericInternalError(
          `Unable to parse platform-states agreement entries: result ${JSON.stringify(
            agreementEntries
          )} - data ${JSON.stringify(data)} `
        );
      }

      if (!data.LastEvaluatedKey) {
        return agreementEntries.data;
      } else {
        return [
          ...agreementEntries.data,
          ...(await runPaginatedQuery(
            consumerId_eserviceId,
            dynamoDBClient,
            data.LastEvaluatedKey
          )),
        ];
      }
    }
  };

  return await runPaginatedQuery(
    consumerId_eserviceId,
    dynamoDBClient,
    undefined
  );
};

export const updateAgreementStateAndDescriptorInfoOnTokenGenStates = async ({
  GSIPK_consumerId_eserviceId,
  agreementId,
  agreementState,
  dynamoDBClient,
  GSIPK_eserviceId_descriptorId,
  catalogEntry,
  logger,
}: {
  GSIPK_consumerId_eserviceId: GSIPKConsumerIdEServiceId;
  agreementId: AgreementId;
  agreementState: AgreementState;
  dynamoDBClient: DynamoDBClient;
  GSIPK_eserviceId_descriptorId: GSIPKEServiceIdDescriptorId;
  catalogEntry: PlatformStatesCatalogEntry | undefined;
  logger: Logger;
}): Promise<TokenGenStatesConsumerClientGSIAgreement[]> => {
  const runPaginatedQuery = async (
    consumerId_eserviceId: GSIPKConsumerIdEServiceId,
    dynamoDBClient: DynamoDBClient,
    exclusiveStartKey?: Record<string, AttributeValue>
  ): Promise<TokenGenStatesConsumerClientGSIAgreement[]> => {
    const input: QueryInput = {
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      IndexName: "Agreement",
      KeyConditionExpression: `GSIPK_consumerId_eserviceId = :gsiValue`,
      ExpressionAttributeValues: {
        ":gsiValue": { S: consumerId_eserviceId },
      },
      ExclusiveStartKey: exclusiveStartKey,
    };
    const command = new QueryCommand(input);
    const data: QueryCommandOutput = await dynamoDBClient.send(command);

    if (!data.Items) {
      throw genericInternalError(
        `Unable to read token-generation-states entries: result ${JSON.stringify(
          data
        )} `
      );
    } else {
      const unmarshalledItems = data.Items.map((item) => unmarshall(item));

      const tokenGenStatesEntries = z
        .array(TokenGenStatesConsumerClientGSIAgreement)
        .safeParse(unmarshalledItems);

      if (!tokenGenStatesEntries.success) {
        throw genericInternalError(
          `Unable to parse token-generation-states entries: result ${JSON.stringify(
            tokenGenStatesEntries
          )} - data ${JSON.stringify(data)} `
        );
      }

      await updateAgreementStateAndDescriptorInfoOnTokenGenStatesEntries({
        entriesToUpdate: tokenGenStatesEntries.data,
        agreementId,
        agreementState,
        dynamoDBClient,
        GSIPK_eserviceId_descriptorId,
        catalogEntry,
        logger,
      });

      if (!data.LastEvaluatedKey) {
        return tokenGenStatesEntries.data;
      } else {
        return [
          ...tokenGenStatesEntries.data,
          ...(await runPaginatedQuery(
            consumerId_eserviceId,
            dynamoDBClient,
            data.LastEvaluatedKey
          )),
        ];
      }
    }
  };

  return await runPaginatedQuery(
    GSIPK_consumerId_eserviceId,
    dynamoDBClient,
    undefined
  );
};

export const extractAgreementIdFromAgreementPK = (
  pk: PlatformStatesAgreementPK
): AgreementId => {
  const substrings = pk.split("#");
  const agreementId = substrings[1];
  const result = AgreementId.safeParse(agreementId);

  if (!result.success) {
    throw genericInternalError(
      `Unable to parse agreement PK: result ${JSON.stringify(
        result
      )} - data ${JSON.stringify(agreementId)} `
    );
  }
  return result.data;
};

export const updateAgreementStateOnTokenGenStates = async ({
  GSIPK_consumerId_eserviceId,
  agreementState,
  dynamoDBClient,
  logger,
}: {
  GSIPK_consumerId_eserviceId: GSIPKConsumerIdEServiceId;
  agreementState: AgreementState;
  dynamoDBClient: DynamoDBClient;
  logger: Logger;
}): Promise<TokenGenStatesConsumerClientGSIAgreement[]> => {
  const runPaginatedQuery = async (
    consumerId_eserviceId: GSIPKConsumerIdEServiceId,
    dynamoDBClient: DynamoDBClient,
    exclusiveStartKey?: Record<string, AttributeValue>
  ): Promise<TokenGenStatesConsumerClientGSIAgreement[]> => {
    const input: QueryInput = {
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      IndexName: "Agreement",
      KeyConditionExpression: `GSIPK_consumerId_eserviceId = :gsiValue`,
      ExpressionAttributeValues: {
        ":gsiValue": { S: consumerId_eserviceId },
      },
      ExclusiveStartKey: exclusiveStartKey,
    };
    const command = new QueryCommand(input);
    const data: QueryCommandOutput = await dynamoDBClient.send(command);

    if (!data.Items) {
      throw genericInternalError(
        `Unable to read token-generation-states entries: result ${JSON.stringify(
          data
        )} `
      );
    } else {
      const unmarshalledItems = data.Items.map((item) => unmarshall(item));

      const tokenGenStatesEntries = z
        .array(TokenGenStatesConsumerClientGSIAgreement)
        .safeParse(unmarshalledItems);

      if (!tokenGenStatesEntries.success) {
        throw genericInternalError(
          `Unable to parse token-generation-states entries: result ${JSON.stringify(
            tokenGenStatesEntries
          )} - data ${JSON.stringify(data)} `
        );
      }

      await updateAgreementStateOnTokenGenStatesEntries({
        entriesToUpdate: tokenGenStatesEntries.data,
        agreementState,
        dynamoDBClient,
        logger,
      });

      if (!data.LastEvaluatedKey) {
        return tokenGenStatesEntries.data;
      } else {
        return [
          ...tokenGenStatesEntries.data,
          ...(await runPaginatedQuery(
            consumerId_eserviceId,
            dynamoDBClient,
            data.LastEvaluatedKey
          )),
        ];
      }
    }
  };

  return await runPaginatedQuery(
    GSIPK_consumerId_eserviceId,
    dynamoDBClient,
    undefined
  );
};

export const readCatalogEntry = async (
  primaryKey: PlatformStatesEServiceDescriptorPK,
  dynamoDBClient: DynamoDBClient
): Promise<PlatformStatesCatalogEntry | undefined> => {
  const input: GetItemInput = {
    Key: {
      PK: { S: primaryKey },
    },
    TableName: config.tokenGenerationReadModelTableNamePlatform,
    ConsistentRead: true,
  };
  const command = new GetItemCommand(input);
  const data: GetItemCommandOutput = await dynamoDBClient.send(command);

  if (!data.Item) {
    return undefined;
  } else {
    const unmarshalled = unmarshall(data.Item);
    const catalogEntry = PlatformStatesCatalogEntry.safeParse(unmarshalled);

    if (!catalogEntry.success) {
      throw genericInternalError(
        `Unable to parse platform-states catalog entry: result ${JSON.stringify(
          catalogEntry
        )} - data ${JSON.stringify(data)} `
      );
    }
    return catalogEntry.data;
  }
};

/* 
Because of DynamoDB eventual consistency, it's possible that the result of querying platform-states by 
GSIPK_consumerId_eserviceId doesn't contain the entry with the latest agreement.
In this case, we need to check if the input agreement timestamp is more recent or equal than GSISK_agreementTimestamp 
of the latest agreement in platform-states.
*/
export const isLatestAgreement = async (
  GSIPK_consumerId_eserviceId: GSIPKConsumerIdEServiceId,
  agreementId: AgreementId,
  currentAgreementTimestamp: string,
  dynamoDBClient: DynamoDBClient
): Promise<boolean> => {
  const agreementEntries =
    await readPlatformStateAgreementEntriesByConsumerIdEserviceId(
      GSIPK_consumerId_eserviceId,
      dynamoDBClient
    );

  if (agreementEntries.length === 0) {
    return true;
  }
  const agreementIdFromEntry = extractAgreementIdFromAgreementPK(
    agreementEntries[0].PK
  );

  return (
    agreementIdFromEntry === agreementId ||
    new Date(currentAgreementTimestamp) >=
      new Date(agreementEntries[0].GSISK_agreementTimestamp)
  );
};

export const updateLatestAgreementOnTokenGenStates = async (
  dynamoDBClient: DynamoDBClient,
  agreement: Agreement,
  logger: Logger
): Promise<void> => {
  const processAgreementUpdateOnTokenGenStates = async (
    platformStatesCatalogEntry: PlatformStatesCatalogEntry | undefined,
    GSIPK_consumerId_eserviceId: GSIPKConsumerIdEServiceId
  ): Promise<void> => {
    const currentAgreementTimestamp = extractAgreementTimestamp(agreement);
    if (
      await isLatestAgreement(
        GSIPK_consumerId_eserviceId,
        agreement.id,
        currentAgreementTimestamp,
        dynamoDBClient
      )
    ) {
      // token-generation-states only if agreement is the latest
      const GSIPK_eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: agreement.eserviceId,
        descriptorId: agreement.descriptorId,
      });

      await updateAgreementStateAndDescriptorInfoOnTokenGenStates({
        GSIPK_consumerId_eserviceId,
        agreementId: agreement.id,
        agreementState: agreement.state,
        dynamoDBClient,
        GSIPK_eserviceId_descriptorId,
        catalogEntry: platformStatesCatalogEntry,
        logger,
      });
    } else {
      logger.info(
        `Token-generation-states. Skipping processing of entry GSIPK_consumerId_eserviceId ${GSIPK_consumerId_eserviceId}. Reason: agreement is not the latest`
      );
    }
  };

  const platformsStatesCatalogEntryPK = makePlatformStatesEServiceDescriptorPK({
    eserviceId: agreement.eserviceId,
    descriptorId: agreement.descriptorId,
  });
  const platformStatesCatalogEntry = await readCatalogEntry(
    platformsStatesCatalogEntryPK,
    dynamoDBClient
  );
  const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
    consumerId: agreement.consumerId,
    eserviceId: agreement.eserviceId,
  });

  await processAgreementUpdateOnTokenGenStates(
    platformStatesCatalogEntry,
    GSIPK_consumerId_eserviceId
  );

  // Second check
  const updatedPlatformStatesCatalogEntry = await readCatalogEntry(
    platformsStatesCatalogEntryPK,
    dynamoDBClient
  );

  if (
    updatedPlatformStatesCatalogEntry &&
    (!platformStatesCatalogEntry ||
      updatedPlatformStatesCatalogEntry.state !==
        platformStatesCatalogEntry.state)
  ) {
    await processAgreementUpdateOnTokenGenStates(
      updatedPlatformStatesCatalogEntry,
      GSIPK_consumerId_eserviceId
    );
  } else {
    logger.info(
      `Token-generation-states. Second retrieval of catalog entry ${platformsStatesCatalogEntryPK} didn't bring any updates to agreement with GSIPK_consumerId_eserviceId ${GSIPK_consumerId_eserviceId}`
    );
  }
};

export const extractAgreementTimestamp = (agreement: Agreement): string =>
  agreement.stamps.upgrade?.when.toISOString() ||
  agreement.stamps.activation?.when.toISOString() ||
  agreement.createdAt.toISOString();
