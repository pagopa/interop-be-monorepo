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

export const writeAgreementEntry = async (
  agreementEntry: PlatformStatesAgreementEntry,
  dynamoDBClient: DynamoDBClient
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

export const updateAgreementStateInPlatformStatesEntry = async (
  dynamoDBClient: DynamoDBClient,
  primaryKey: PlatformStatesAgreementPK,
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
};

export const agreementStateToItemState = (state: AgreementState): ItemState =>
  state === agreementState.active ? itemState.active : itemState.inactive;

export const updateAgreementStateOnTokenGenStatesEntries = async ({
  entriesToUpdate,
  agreementState,
  dynamoDBClient,
}: {
  entriesToUpdate: TokenGenStatesConsumerClientGSIAgreement[];
  agreementState: AgreementState;
  dynamoDBClient: DynamoDBClient;
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
  }: {
    entriesToUpdate: TokenGenStatesConsumerClientGSIAgreement[];
    agreementId: AgreementId;
    agreementState: AgreementState;
    dynamoDBClient: DynamoDBClient;
    GSIPK_eserviceId_descriptorId: GSIPKEServiceIdDescriptorId;
    catalogEntry: PlatformStatesCatalogEntry | undefined;
  }): Promise<void> => {
    for (const entry of entriesToUpdate) {
      const additionalDescriptorInfo =
        catalogEntry &&
        (!entry.descriptorState ||
          !entry.descriptorAudience ||
          !entry.descriptorVoucherLifespan);

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
      KeyConditionExpression: `GSIPK_consumerId_eserviceId = :GSIPK_consumerId_eserviceId`,
      ExpressionAttributeValues: {
        ":GSIPK_consumerId_eserviceId": { S: consumerId_eserviceId },
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
}: {
  GSIPK_consumerId_eserviceId: GSIPKConsumerIdEServiceId;
  agreementId: AgreementId;
  agreementState: AgreementState;
  dynamoDBClient: DynamoDBClient;
  GSIPK_eserviceId_descriptorId: GSIPKEServiceIdDescriptorId;
  catalogEntry: PlatformStatesCatalogEntry | undefined;
}): Promise<TokenGenStatesConsumerClientGSIAgreement[]> => {
  const runPaginatedQuery = async (
    consumerId_eserviceId: GSIPKConsumerIdEServiceId,
    dynamoDBClient: DynamoDBClient,
    exclusiveStartKey?: Record<string, AttributeValue>
  ): Promise<TokenGenStatesConsumerClientGSIAgreement[]> => {
    const input: QueryInput = {
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      IndexName: "Agreement",
      KeyConditionExpression: `GSIPK_consumerId_eserviceId = :GSIPK_consumerId_eserviceId`,
      ExpressionAttributeValues: {
        ":GSIPK_consumerId_eserviceId": { S: consumerId_eserviceId },
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
}: {
  GSIPK_consumerId_eserviceId: GSIPKConsumerIdEServiceId;
  agreementState: AgreementState;
  dynamoDBClient: DynamoDBClient;
}): Promise<TokenGenStatesConsumerClientGSIAgreement[]> => {
  const runPaginatedQuery = async (
    consumerId_eserviceId: GSIPKConsumerIdEServiceId,
    dynamoDBClient: DynamoDBClient,
    exclusiveStartKey?: Record<string, AttributeValue>
  ): Promise<TokenGenStatesConsumerClientGSIAgreement[]> => {
    const input: QueryInput = {
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      IndexName: "Agreement",
      KeyConditionExpression: `GSIPK_consumerId_eserviceId = :GSIPK_consumerId_eserviceId`,
      ExpressionAttributeValues: {
        ":GSIPK_consumerId_eserviceId": { S: consumerId_eserviceId },
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

export const isLatestAgreement = async (
  GSIPK_consumerId_eserviceId: GSIPKConsumerIdEServiceId,
  agreementId: AgreementId,
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
  return agreementIdFromEntry === agreementId;
};
