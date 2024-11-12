import {
  descriptorState,
  DescriptorState,
  genericInternalError,
  GSIPKEServiceIdDescriptorId,
  itemState,
  ItemState,
  PlatformStatesCatalogEntry,
  PlatformStatesEServiceDescriptorPK,
  TokenGenerationStatesClientPurposeEntry,
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
import { config } from "./config/config.js";

export const writeCatalogEntry = async (
  catalogEntry: PlatformStatesCatalogEntry,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const input: PutItemInput = {
    ConditionExpression: "attribute_not_exists(PK)",
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
        `Unable to parse catalog entry item: result ${JSON.stringify(
          catalogEntry
        )} - data ${JSON.stringify(data)} `
      );
    }
    return catalogEntry.data;
  }
};

export const deleteCatalogEntry = async (
  primaryKey: PlatformStatesEServiceDescriptorPK,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const input: DeleteItemInput = {
    Key: {
      PK: { S: primaryKey },
    },
    TableName: config.tokenGenerationReadModelTableNamePlatform,
  };
  const command = new DeleteItemCommand(input);
  await dynamoDBClient.send(command);
};

export const descriptorStateToItemState = (state: DescriptorState): ItemState =>
  state === descriptorState.published || state === descriptorState.deprecated
    ? itemState.active
    : itemState.inactive;

export const updateDescriptorStateInPlatformStatesEntry = async (
  dynamoDBClient: DynamoDBClient,
  primaryKey: PlatformStatesEServiceDescriptorPK,
  state: ItemState,
  version: number
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
      ":newUpdateAt": {
        S: new Date().toISOString(),
      },
    },
    ExpressionAttributeNames: {
      "#state": "state",
    },
    UpdateExpression:
      "SET #state = :newState, version = :newVersion, updatedAt = :newUpdateAt",
    TableName: config.tokenGenerationReadModelTableNamePlatform,
    ReturnValues: "NONE",
  };
  const command = new UpdateItemCommand(input);
  await dynamoDBClient.send(command);
};

export const updateDescriptorVoucherLifespanInPlatformStateEntry = async (
  dynamoDBClient: DynamoDBClient,
  primaryKey: PlatformStatesEServiceDescriptorPK,
  voucherLifespan: number,
  version: number
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
      ":newUpdateAt": {
        S: new Date().toISOString(),
      },
    },
    UpdateExpression:
      "SET descriptorVoucherLifespan = :newVoucherLifespan, version = :newVersion, updatedAt = :newUpdateAt",
    TableName: config.tokenGenerationReadModelTableNamePlatform,
    ReturnValues: "NONE",
  };
  const command = new UpdateItemCommand(input);
  await dynamoDBClient.send(command);
};

export const updateDescriptorStateInTokenGenerationStatesTable = async (
  eserviceId_descriptorId: GSIPKEServiceIdDescriptorId,
  descriptorState: ItemState,
  dynamoDBClient: DynamoDBClient
): Promise<TokenGenerationStatesClientPurposeEntry[]> => {
  const runPaginatedQuery = async (
    eserviceId_descriptorId: GSIPKEServiceIdDescriptorId,
    dynamoDBClient: DynamoDBClient,
    exclusiveStartKey?: Record<string, AttributeValue>
  ): Promise<TokenGenerationStatesClientPurposeEntry[]> => {
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
    const data: QueryCommandOutput = await dynamoDBClient.send(command);

    if (!data.Items) {
      throw genericInternalError(
        `Unable to read token state entries: result ${JSON.stringify(data)} `
      );
    } else {
      const unmarshalledItems = data.Items.map((item) => unmarshall(item));

      const tokenStateEntries = z
        .array(TokenGenerationStatesClientPurposeEntry)
        .safeParse(unmarshalledItems);

      if (!tokenStateEntries.success) {
        throw genericInternalError(
          `Unable to parse token state entry item: result ${JSON.stringify(
            tokenStateEntries
          )} - data ${JSON.stringify(data)} `
        );
      }

      await updateDescriptorStateInTokenGenerationStatesEntries(
        descriptorState,
        dynamoDBClient,
        tokenStateEntries.data
      );

      if (!data.LastEvaluatedKey) {
        return tokenStateEntries.data;
      } else {
        return [
          ...tokenStateEntries.data,
          ...(await runPaginatedQuery(
            eserviceId_descriptorId,
            dynamoDBClient,
            data.LastEvaluatedKey
          )),
        ];
      }
    }
  };

  return await runPaginatedQuery(
    eserviceId_descriptorId,
    dynamoDBClient,
    undefined
  );
};

export const updateDescriptorInfoInTokenGenerationStatesTable = async (
  eserviceId_descriptorId: GSIPKEServiceIdDescriptorId,
  descriptorState: ItemState,
  descriptorVoucherLifespan: number,
  descriptorAudience: string[],
  dynamoDBClient: DynamoDBClient
): Promise<TokenGenerationStatesClientPurposeEntry[]> => {
  const runPaginatedQuery = async (
    eserviceId_descriptorId: GSIPKEServiceIdDescriptorId,
    dynamoDBClient: DynamoDBClient,
    exclusiveStartKey?: Record<string, AttributeValue>
  ): Promise<TokenGenerationStatesClientPurposeEntry[]> => {
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
    const data: QueryCommandOutput = await dynamoDBClient.send(command);

    if (!data.Items) {
      throw genericInternalError(
        `Unable to read token state entries: result ${JSON.stringify(data)} `
      );
    } else {
      const unmarshalledItems = data.Items.map((item) => unmarshall(item));

      const tokenStateEntries = z
        .array(TokenGenerationStatesClientPurposeEntry)
        .safeParse(unmarshalledItems);

      if (!tokenStateEntries.success) {
        throw genericInternalError(
          `Unable to parse token state entry item: result ${JSON.stringify(
            tokenStateEntries
          )} - data ${JSON.stringify(data)} `
        );
      }

      console.log(
        "these entries will be updated: ",
        tokenStateEntries.data.map((item) => item.PK)
      );
      await updateDescriptorInfoInTokenGenerationStatesEntries({
        descriptorState,
        descriptorVoucherLifespan,
        descriptorAudience,
        GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        dynamoDBClient,
        entriesToUpdate: tokenStateEntries.data,
      });

      if (!data.LastEvaluatedKey) {
        return tokenStateEntries.data;
      } else {
        return [
          ...tokenStateEntries.data,
          ...(await runPaginatedQuery(
            eserviceId_descriptorId,
            dynamoDBClient,
            data.LastEvaluatedKey
          )),
        ];
      }
    }
  };

  return await runPaginatedQuery(
    eserviceId_descriptorId,
    dynamoDBClient,
    undefined
  );
};

export const updateDescriptorVoucherLifespanInTokenGenerationStatesTable =
  async (
    eserviceId_descriptorId: GSIPKEServiceIdDescriptorId,
    voucherLifespan: number,
    dynamoDBClient: DynamoDBClient
  ): Promise<TokenGenerationStatesClientPurposeEntry[]> => {
    const runPaginatedQuery = async (
      eserviceId_descriptorId: GSIPKEServiceIdDescriptorId,
      dynamoDBClient: DynamoDBClient,
      exclusiveStartKey?: Record<string, AttributeValue>
    ): Promise<TokenGenerationStatesClientPurposeEntry[]> => {
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
      const data: QueryCommandOutput = await dynamoDBClient.send(command);

      if (!data.Items) {
        throw genericInternalError(
          `Unable to read token state entries: result ${JSON.stringify(data)} `
        );
      } else {
        const unmarshalledItems = data.Items.map((item) => unmarshall(item));

        const tokenStateEntries = z
          .array(TokenGenerationStatesClientPurposeEntry)
          .safeParse(unmarshalledItems);

        if (!tokenStateEntries.success) {
          throw genericInternalError(
            `Unable to parse token state entry item: result ${JSON.stringify(
              tokenStateEntries
            )} - data ${JSON.stringify(data)} `
          );
        }

        await updateDescriptorVoucherLifespanInTokenGenerationStatesEntries(
          voucherLifespan,
          dynamoDBClient,
          tokenStateEntries.data
        );

        if (!data.LastEvaluatedKey) {
          return tokenStateEntries.data;
        } else {
          return [
            ...tokenStateEntries.data,
            ...(await runPaginatedQuery(
              eserviceId_descriptorId,
              dynamoDBClient,
              data.LastEvaluatedKey
            )),
          ];
        }
      }
    };

    return await runPaginatedQuery(
      eserviceId_descriptorId,
      dynamoDBClient,
      undefined
    );
  };

const updateDescriptorStateInTokenGenerationStatesEntries = async (
  descriptorState: ItemState,
  dynamoDBClient: DynamoDBClient,
  entriesToUpdate: TokenGenerationStatesClientPurposeEntry[]
): Promise<void> => {
  for (const entry of entriesToUpdate) {
    const input: UpdateItemInput = {
      // ConditionExpression: "attribute_exists(GSIPK_eserviceId_descriptorId)",
      Key: {
        PK: {
          S: entry.PK,
        },
      },
      ExpressionAttributeValues: {
        ":newState": {
          S: descriptorState,
        },
        ":newUpdateAt": {
          S: new Date().toISOString(),
        },
      },
      UpdateExpression:
        "SET descriptorState = :newState, updatedAt = :newUpdateAt",
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      ReturnValues: "NONE",
    };
    const command = new UpdateItemCommand(input);
    await dynamoDBClient.send(command);
  }
};

const updateDescriptorInfoInTokenGenerationStatesEntries = async ({
  descriptorState,
  descriptorVoucherLifespan,
  descriptorAudience,
  GSIPK_eserviceId_descriptorId,
  dynamoDBClient,
  entriesToUpdate,
}: {
  descriptorState: ItemState;
  descriptorVoucherLifespan: number;
  descriptorAudience: string[];
  GSIPK_eserviceId_descriptorId: GSIPKEServiceIdDescriptorId;
  dynamoDBClient: DynamoDBClient;
  entriesToUpdate: TokenGenerationStatesClientPurposeEntry[];
}): Promise<void> => {
  for (const entry of entriesToUpdate) {
    const input: UpdateItemInput = {
      // TODO double check if we can safely remove this
      // ConditionExpression: "attribute_exists(GSIPK_eserviceId_descriptorId)",
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
        ":gsi": {
          S: GSIPK_eserviceId_descriptorId,
        },
        ":newUpdateAt": {
          S: new Date().toISOString(),
        },
      },
      UpdateExpression:
        "SET GSI_eservice_id_descriptor_id = :gsi, descriptorState = :descriptorState, descriptorAudience = :descriptorAudience, descriptorVoucherLifespan = :descriptorVoucherLifespan, updatedAt = :newUpdateAt",
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      ReturnValues: "NONE",
    };
    const command = new UpdateItemCommand(input);
    await dynamoDBClient.send(command);
  }
};

const updateDescriptorVoucherLifespanInTokenGenerationStatesEntries = async (
  voucherLifespan: number,
  dynamoDBClient: DynamoDBClient,
  entriesToUpdate: TokenGenerationStatesClientPurposeEntry[]
): Promise<void> => {
  for (const entry of entriesToUpdate) {
    const input: UpdateItemInput = {
      // TODO check if we can remove the condition
      // ConditionExpression: "attribute_exists(GSIPK_eserviceId_descriptorId)",
      Key: {
        PK: {
          S: entry.PK,
        },
      },
      ExpressionAttributeValues: {
        ":newVoucherLifespan": {
          N: voucherLifespan.toString(),
        },
        ":newUpdateAt": {
          S: new Date().toISOString(),
        },
      },
      UpdateExpression:
        "SET descriptorVoucherLifespan = :newVoucherLifespan, updatedAt = :newUpdateAt",
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      ReturnValues: "NONE",
    };
    const command = new UpdateItemCommand(input);
    await dynamoDBClient.send(command);
  }
};
