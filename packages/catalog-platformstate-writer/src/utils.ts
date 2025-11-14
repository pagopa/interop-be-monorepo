import {
  descriptorState,
  DescriptorState,
  genericInternalError,
  GSIPKEServiceIdDescriptorId,
  itemState,
  ItemState,
  PlatformStatesCatalogEntry,
  PlatformStatesEServiceDescriptorPK,
  TokenGenStatesConsumerClientGSIDescriptor,
} from "pagopa-interop-models";
import {
  AttributeValue,
  ConditionalCheckFailedException,
  DeleteItemCommand,
  DeleteItemInput,
  DynamoDBClient,
  GetItemCommand,
  GetItemInput,
  PutItemCommand,
  PutItemInput,
  QueryCommand,
  QueryInput,
  UpdateItemCommand,
  UpdateItemInput,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { z } from "zod";
import { Logger } from "pagopa-interop-commons";
import { config } from "./config/config.js";

export const upsertPlatformStatesCatalogEntry = async (
  catalogEntry: PlatformStatesCatalogEntry,
  dynamoDBClient: DynamoDBClient,
  logger: Logger
): Promise<void> => {
  const input: PutItemInput = {
    Item: {
      PK: {
        S: catalogEntry.PK,
      },
      state: {
        S: catalogEntry.state,
      },
      descriptorAudience: {
        L: catalogEntry.descriptorAudience.map((item) => ({
          S: item,
        })),
      },
      descriptorVoucherLifespan: {
        N: catalogEntry.descriptorVoucherLifespan.toString(),
      },
      version: {
        N: catalogEntry.version.toString(),
      },
      updatedAt: {
        S: catalogEntry.updatedAt,
      },
    },
    TableName: config.tokenGenerationReadModelTableNamePlatform,
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
  logger.info(`Platform-states. Upserted catalog entry ${catalogEntry.PK}`);
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
  const data = await dynamoDBClient.send(command);

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

export const deleteCatalogEntry = async (
  primaryKey: PlatformStatesEServiceDescriptorPK,
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
  logger.info(`Platform-states. Deleted catalog entry ${primaryKey}`);
};

export const descriptorStateToItemState = (state: DescriptorState): ItemState =>
  state === descriptorState.published || state === descriptorState.deprecated
    ? itemState.active
    : itemState.inactive;

export const updateDescriptorStateInPlatformStatesEntry = async (
  dynamoDBClient: DynamoDBClient,
  primaryKey: PlatformStatesEServiceDescriptorPK,
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
    `Platform-states. Updated descriptor state in entry ${primaryKey}`
  );
};

export const updateDescriptorVoucherLifespanInPlatformStateEntry = async (
  dynamoDBClient: DynamoDBClient,
  primaryKey: PlatformStatesEServiceDescriptorPK,
  voucherLifespan: number,
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
      ":newVoucherLifespan": {
        N: voucherLifespan.toString(),
      },
      ":newVersion": {
        N: version.toString(),
      },
      ":newUpdatedAt": {
        S: new Date().toISOString(),
      },
    },
    UpdateExpression:
      "SET descriptorVoucherLifespan = :newVoucherLifespan, version = :newVersion, updatedAt = :newUpdatedAt",
    TableName: config.tokenGenerationReadModelTableNamePlatform,
    ReturnValues: "NONE",
  };
  const command = new UpdateItemCommand(input);
  await dynamoDBClient.send(command);
  logger.info(
    `Platform-states. Updated descriptor voucher lifespan state in entry ${primaryKey}`
  );
};

export const updateDescriptorStateInTokenGenerationStatesTable = async (
  eserviceId_descriptorId: GSIPKEServiceIdDescriptorId,
  descriptorState: ItemState,
  dynamoDBClient: DynamoDBClient,
  logger: Logger
): Promise<void> => {
  // eslint-disable-next-line functional/no-let
  let exclusiveStartKey: Record<string, AttributeValue> | undefined;

  do {
    const input: QueryInput = {
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      IndexName: "Descriptor",
      KeyConditionExpression: `GSIPK_eserviceId_descriptorId = :gsiValue`,
      ExpressionAttributeValues: {
        ":gsiValue": { S: eserviceId_descriptorId },
      },
      ExclusiveStartKey: exclusiveStartKey,
    };
    const command = new QueryCommand(input);
    const data = await dynamoDBClient.send(command);

    if (!data.Items) {
      throw genericInternalError(
        `Unable to read token-generation-states entries: result ${JSON.stringify(
          data
        )} `
      );
    } else {
      const unmarshalledItems = data.Items.map((item) => unmarshall(item));

      const tokenGenStatesEntries = z
        .array(TokenGenStatesConsumerClientGSIDescriptor)
        .safeParse(unmarshalledItems);

      if (!tokenGenStatesEntries.success) {
        throw genericInternalError(
          `Unable to parse token-generation-states entries: result ${JSON.stringify(
            tokenGenStatesEntries
          )} - data ${JSON.stringify(data)} `
        );
      }

      await updateDescriptorStateInTokenGenerationStatesEntries(
        descriptorState,
        dynamoDBClient,
        tokenGenStatesEntries.data,
        eserviceId_descriptorId,
        logger
      );

      exclusiveStartKey = data.LastEvaluatedKey;
    }
  } while (exclusiveStartKey);
};

export const updateDescriptorInfoInTokenGenerationStatesTable = async (
  eserviceId_descriptorId: GSIPKEServiceIdDescriptorId,
  descriptorState: ItemState,
  descriptorVoucherLifespan: number,
  descriptorAudience: string[],
  dynamoDBClient: DynamoDBClient,
  logger: Logger
  // eslint-disable-next-line max-params
): Promise<void> => {
  // eslint-disable-next-line functional/no-let
  let exclusiveStartKey: Record<string, AttributeValue> | undefined;

  do {
    const input: QueryInput = {
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      IndexName: "Descriptor",
      KeyConditionExpression: `GSIPK_eserviceId_descriptorId = :gsiValue`,
      ExpressionAttributeValues: {
        ":gsiValue": { S: eserviceId_descriptorId },
      },
      ExclusiveStartKey: exclusiveStartKey,
    };
    const command = new QueryCommand(input);
    const data = await dynamoDBClient.send(command);

    if (!data.Items) {
      throw genericInternalError(
        `Unable to read token-generation-states entries: result ${JSON.stringify(
          data
        )} `
      );
    } else {
      const unmarshalledItems = data.Items.map((item) => unmarshall(item));

      const tokenGenStatesEntries = z
        .array(TokenGenStatesConsumerClientGSIDescriptor)
        .safeParse(unmarshalledItems);

      if (!tokenGenStatesEntries.success) {
        throw genericInternalError(
          `Unable to parse token-generation-states entries: result ${JSON.stringify(
            tokenGenStatesEntries
          )} - data ${JSON.stringify(data)} `
        );
      }

      await updateDescriptorInfoInTokenGenerationStatesEntries({
        descriptorState,
        descriptorVoucherLifespan,
        descriptorAudience,
        dynamoDBClient,
        entriesToUpdate: tokenGenStatesEntries.data,
        logger,
      });

      exclusiveStartKey = data.LastEvaluatedKey;
    }
  } while (exclusiveStartKey);
};

export const updateDescriptorVoucherLifespanInTokenGenerationStatesTable =
  async (
    eserviceId_descriptorId: GSIPKEServiceIdDescriptorId,
    voucherLifespan: number,
    dynamoDBClient: DynamoDBClient,
    logger: Logger
  ): Promise<void> => {
    // eslint-disable-next-line functional/no-let
    let exclusiveStartKey: Record<string, AttributeValue> | undefined;

    do {
      const input: QueryInput = {
        TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
        IndexName: "Descriptor",
        KeyConditionExpression: `GSIPK_eserviceId_descriptorId = :gsiValue`,
        ExpressionAttributeValues: {
          ":gsiValue": { S: eserviceId_descriptorId },
        },
        ExclusiveStartKey: exclusiveStartKey,
      };
      const command = new QueryCommand(input);
      const data = await dynamoDBClient.send(command);

      if (!data.Items) {
        throw genericInternalError(
          `Unable to read token-generation-states entries: result ${JSON.stringify(
            data
          )} `
        );
      } else {
        const unmarshalledItems = data.Items.map((item) => unmarshall(item));

        const tokenGenStatesEntries = z
          .array(TokenGenStatesConsumerClientGSIDescriptor)
          .safeParse(unmarshalledItems);

        if (!tokenGenStatesEntries.success) {
          throw genericInternalError(
            `Unable to parse token-generation-states entries: result ${JSON.stringify(
              tokenGenStatesEntries
            )} - data ${JSON.stringify(data)} `
          );
        }

        await updateDescriptorVoucherLifespanInTokenGenerationStatesEntries(
          voucherLifespan,
          dynamoDBClient,
          tokenGenStatesEntries.data,
          logger
        );

        exclusiveStartKey = data.LastEvaluatedKey;
      }
    } while (exclusiveStartKey);
  };

const updateDescriptorStateInTokenGenerationStatesEntries = async (
  descriptorState: ItemState,
  dynamoDBClient: DynamoDBClient,
  entriesToUpdate: TokenGenStatesConsumerClientGSIDescriptor[],
  GSIPK_eserviceId_descriptorId: GSIPKEServiceIdDescriptorId,
  logger: Logger
): Promise<void> => {
  for (const entry of entriesToUpdate) {
    try {
      const input: UpdateItemInput = {
        ConditionExpression:
          "attribute_exists(PK) AND GSIPK_eserviceId_descriptorId = :gsiValue",
        Key: {
          PK: {
            S: entry.PK,
          },
        },
        ExpressionAttributeValues: {
          ":newState": {
            S: descriptorState,
          },
          ":newUpdatedAt": {
            S: new Date().toISOString(),
          },
          ":gsiValue": { S: GSIPK_eserviceId_descriptorId },
        },
        UpdateExpression:
          "SET descriptorState = :newState, updatedAt = :newUpdatedAt",
        TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
        ReturnValues: "NONE",
      };
      const command = new UpdateItemCommand(input);
      await dynamoDBClient.send(command);
      logger.info(
        `Token-generation-states. Updated descriptor state in entry ${entry.PK}`
      );
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        logger.info(
          `Token-generation-states. Skipping update of descriptor state in entry ${entry.PK} due to conditional check failure: ${error}`
        );
        continue;
      }
      throw error;
    }
  }
};

const updateDescriptorInfoInTokenGenerationStatesEntries = async ({
  descriptorState,
  descriptorVoucherLifespan,
  descriptorAudience,
  dynamoDBClient,
  entriesToUpdate,
  logger,
}: {
  descriptorState: ItemState;
  descriptorVoucherLifespan: number;
  descriptorAudience: string[];
  dynamoDBClient: DynamoDBClient;
  entriesToUpdate: TokenGenStatesConsumerClientGSIDescriptor[];
  logger: Logger;
}): Promise<void> => {
  for (const entry of entriesToUpdate) {
    const input: UpdateItemInput = {
      ConditionExpression: "attribute_exists(PK)",
      Key: {
        PK: {
          S: entry.PK,
        },
      },
      ExpressionAttributeValues: {
        ":descriptorState": {
          S: descriptorState,
        },
        ":descriptorAudience": {
          L: descriptorAudience.map((item) => ({
            S: item,
          })),
        },
        ":descriptorVoucherLifespan": {
          N: descriptorVoucherLifespan.toString(),
        },
        ":newUpdatedAt": {
          S: new Date().toISOString(),
        },
      },
      UpdateExpression:
        "SET descriptorState = :descriptorState, descriptorAudience = :descriptorAudience, descriptorVoucherLifespan = :descriptorVoucherLifespan, updatedAt = :newUpdatedAt",
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      ReturnValues: "NONE",
    };
    const command = new UpdateItemCommand(input);
    await dynamoDBClient.send(command);
    logger.info(
      `Token-generation-states. Updated descriptor info in entry ${entry.PK}`
    );
  }
};

const updateDescriptorVoucherLifespanInTokenGenerationStatesEntries = async (
  voucherLifespan: number,
  dynamoDBClient: DynamoDBClient,
  entriesToUpdate: TokenGenStatesConsumerClientGSIDescriptor[],
  logger: Logger
): Promise<void> => {
  for (const entry of entriesToUpdate) {
    const input: UpdateItemInput = {
      ConditionExpression: "attribute_exists(PK)",
      Key: {
        PK: {
          S: entry.PK,
        },
      },
      ExpressionAttributeValues: {
        ":newVoucherLifespan": {
          N: voucherLifespan.toString(),
        },
        ":newUpdatedAt": {
          S: new Date().toISOString(),
        },
      },
      UpdateExpression:
        "SET descriptorVoucherLifespan = :newVoucherLifespan, updatedAt = :newUpdatedAt",
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      ReturnValues: "NONE",
    };
    const command = new UpdateItemCommand(input);
    await dynamoDBClient.send(command);
    logger.info(
      `Token-generation-states. Updated descriptor info in entry ${entry.PK}`
    );
  }
};
