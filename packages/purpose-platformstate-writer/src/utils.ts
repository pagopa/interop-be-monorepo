import {
  AttributeValue,
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
import {
  genericInternalError,
  itemState,
  ItemState,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKEServiceIdDescriptorId,
  makePlatformStatesAgreementPK,
  makePlatformStatesEServiceDescriptorPK,
  PlatformStatesAgreementEntry,
  PlatformStatesAgreementPK,
  PlatformStatesCatalogEntry,
  PlatformStatesEServiceDescriptorPK,
  PlatformStatesPurposeEntry,
  PlatformStatesPurposePK,
  Purpose,
  PurposeId,
  PurposeVersion,
  PurposeVersionId,
  purposeVersionState,
  TenantId,
  TokenGenStatesConsumerClientGSIPurpose,
} from "pagopa-interop-models";
import { z } from "zod";
import { Logger } from "pagopa-interop-commons";
import { config } from "./config/config.js";

export const getPurposeStateFromPurposeVersions = (
  purposeVersions: PurposeVersion[]
): ItemState => {
  if (purposeVersions.find((v) => v.state === purposeVersionState.active)) {
    return itemState.active;
  } else {
    return itemState.inactive;
  }
};

export const upsertPlatformStatesPurposeEntry = async (
  dynamoDBClient: DynamoDBClient,
  purposeEntry: PlatformStatesPurposeEntry,
  logger: Logger
): Promise<void> => {
  const input: PutItemInput = {
    Item: {
      PK: {
        S: purposeEntry.PK,
      },
      state: {
        S: purposeEntry.state,
      },
      purposeVersionId: {
        S: purposeEntry.purposeVersionId,
      },
      purposeEserviceId: {
        S: purposeEntry.purposeEserviceId,
      },
      purposeConsumerId: {
        S: purposeEntry.purposeConsumerId,
      },
      version: {
        N: purposeEntry.version.toString(),
      },
      updatedAt: {
        S: purposeEntry.updatedAt,
      },
    },
    TableName: config.tokenGenerationReadModelTableNamePlatform,
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
  logger.info(`Platform-states. Upserted purpose entry ${purposeEntry.PK}`);
};

export const readPlatformPurposeEntry = async (
  dynamoDBClient: DynamoDBClient,
  primaryKey: PlatformStatesPurposePK
): Promise<PlatformStatesPurposeEntry | undefined> => {
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
    const purposeEntry = PlatformStatesPurposeEntry.safeParse(unmarshalled);

    if (!purposeEntry.success) {
      throw genericInternalError(
        `Unable to parse platform-states purpose entry: result ${JSON.stringify(
          purposeEntry
        )} - data ${JSON.stringify(data)} `
      );
    }
    return purposeEntry.data;
  }
};

export const deletePlatformPurposeEntry = async (
  dynamoDBClient: DynamoDBClient,
  primaryKey: PlatformStatesPurposePK,
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
  logger.info(`Platform-states. Deleted purpose entry ${primaryKey}`);
};

export const readTokenGenStatesEntriesByGSIPKPurposeId = async (
  dynamoDBClient: DynamoDBClient,
  purposeId: PurposeId,
  exclusiveStartKey?: Record<string, AttributeValue>
): Promise<{
  tokenGenStatesEntries: TokenGenStatesConsumerClientGSIPurpose[];
  lastEvaluatedKey?: Record<string, AttributeValue>;
}> => {
  const input: QueryInput = {
    TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
    IndexName: "Purpose",
    KeyConditionExpression: `GSIPK_purposeId = :gsiValue`,
    ExpressionAttributeValues: {
      ":gsiValue": { S: purposeId },
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
      .array(TokenGenStatesConsumerClientGSIPurpose)
      .safeParse(unmarshalledItems);

    if (!tokenGenStatesEntries.success) {
      throw genericInternalError(
        `Unable to parse token-generation-states entries: result ${JSON.stringify(
          tokenGenStatesEntries
        )} - data ${JSON.stringify(data)} `
      );
    }

    return {
      tokenGenStatesEntries: tokenGenStatesEntries.data,
      lastEvaluatedKey: data.LastEvaluatedKey,
    };
  }
};

export const updatePurposeDataInPlatformStatesEntry = async ({
  dynamoDBClient,
  primaryKey,
  purposeState,
  purposeVersionId,
  version,
  logger,
}: {
  dynamoDBClient: DynamoDBClient;
  primaryKey: PlatformStatesPurposePK;
  purposeState: ItemState;
  purposeVersionId: PurposeVersionId;
  version: number;
  logger: Logger;
}): Promise<void> => {
  const input: UpdateItemInput = {
    ConditionExpression: "attribute_exists(PK)",
    Key: {
      PK: {
        S: primaryKey,
      },
    },
    ExpressionAttributeValues: {
      ":newState": {
        S: purposeState,
      },
      ":newPurposeVersionId": {
        S: purposeVersionId,
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
      "SET #state = :newState, version = :newVersion, updatedAt = :newUpdatedAt, purposeVersionId = :newPurposeVersionId",
    TableName: config.tokenGenerationReadModelTableNamePlatform,
    ReturnValues: "NONE",
  };
  const command = new UpdateItemCommand(input);
  await dynamoDBClient.send(command);
  logger.info(`Platform-states. Updated purpose entry ${primaryKey}`);
};

export const updateTokenGenStatesEntriesWithPurposeAndPlatformStatesData =
  // eslint-disable-next-line complexity
  async (
    dynamoDBClient: DynamoDBClient,
    purpose: Purpose,
    purposeState: ItemState,
    purposeVersionId: PurposeVersionId,
    logger: Logger
    // eslint-disable-next-line sonarjs/cognitive-complexity
  ): Promise<void> => {
    // eslint-disable-next-line functional/no-let
    let exclusiveStartKey: Record<string, AttributeValue> | undefined;

    do {
      const { tokenGenStatesEntries, lastEvaluatedKey } =
        await readTokenGenStatesEntriesByGSIPKPurposeId(
          dynamoDBClient,
          purpose.id,
          exclusiveStartKey
        );

      if (tokenGenStatesEntries.length === 0) {
        return;
      }
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: purpose.consumerId,
        eserviceId: purpose.eserviceId,
      });

      const agreementPlatformStatesPK = makePlatformStatesAgreementPK({
        consumerId: purpose.consumerId,
        eserviceId: purpose.eserviceId,
      });

      const platformAgreementEntry = await readAgreementEntry(
        agreementPlatformStatesPK,
        dynamoDBClient
      );

      const { catalogEntryPK, gsiPKEServiceIdDescriptorId } =
        platformAgreementEntry
          ? {
              catalogEntryPK: makePlatformStatesEServiceDescriptorPK({
                eserviceId: purpose.eserviceId,
                descriptorId: platformAgreementEntry.agreementDescriptorId,
              }),
              gsiPKEServiceIdDescriptorId: makeGSIPKEServiceIdDescriptorId({
                eserviceId: purpose.eserviceId,
                descriptorId: platformAgreementEntry.agreementDescriptorId,
              }),
            }
          : {
              catalogEntryPK: undefined,
              gsiPKEServiceIdDescriptorId: undefined,
            };

      if (catalogEntryPK) {
        logger.info(
          `Retrieving platform-states catalog entry ${catalogEntryPK} to add descriptor info in token-generation-states`
        );
      }

      const catalogEntry = catalogEntryPK
        ? await readCatalogEntry(dynamoDBClient, catalogEntryPK)
        : undefined;

      for (const entry of tokenGenStatesEntries) {
        const tokenEntryPK = entry.PK;

        // Agreement data from platform-states
        // Agreement info should be filled when the fields are missing or outdated
        const isAgreementMissingInTokenGenStates =
          !!platformAgreementEntry &&
          !!gsiPKEServiceIdDescriptorId &&
          (entry.agreementId !== platformAgreementEntry.agreementId ||
            entry.agreementState !== platformAgreementEntry.state ||
            entry.GSIPK_eserviceId_descriptorId !==
              gsiPKEServiceIdDescriptorId ||
            entry.producerId !== platformAgreementEntry.producerId);

        if (isAgreementMissingInTokenGenStates) {
          logger.info(
            `Adding agreement info to token-generation-states entry with PK ${tokenEntryPK} and GSIPK_consumerId_eserviceId ${GSIPK_consumerId_eserviceId}`
          );
        }
        const agreementExpressionAttributeValues: Record<
          string,
          AttributeValue
        > = isAgreementMissingInTokenGenStates
          ? {
              ":agreementId": {
                S: platformAgreementEntry.agreementId,
              },
              ":agreementState": {
                S: platformAgreementEntry.state,
              },
              ":producerId": {
                S: platformAgreementEntry.producerId,
              },
              ":gsiPKEServiceIdDescriptorId": {
                S: gsiPKEServiceIdDescriptorId,
              },
            }
          : {};
        const agreementUpdateExpression = isAgreementMissingInTokenGenStates
          ? `, agreementId = :agreementId, 
      agreementState = :agreementState,
      producerId = :producerId,
      GSIPK_eserviceId_descriptorId = :gsiPKEServiceIdDescriptorId`
          : "";

        // Descriptor data from platform-states
        // Descriptor info should be filled when the fields are missing or outdated
        const isDescriptorDataMissingInTokenGenStates =
          !!platformAgreementEntry &&
          !!catalogEntry &&
          (entry.descriptorAudience !== catalogEntry.descriptorAudience ||
            entry.descriptorState !== catalogEntry.state ||
            entry.descriptorVoucherLifespan !==
              catalogEntry.descriptorVoucherLifespan);

        if (isDescriptorDataMissingInTokenGenStates) {
          logger.info(
            `Adding descriptor info to token-generation-states entry with PK ${tokenEntryPK} and GSIPK_eserviceId_descriptorId ${gsiPKEServiceIdDescriptorId}`
          );
        }

        const descriptorExpressionAttributeValues: Record<
          string,
          AttributeValue
        > = isDescriptorDataMissingInTokenGenStates
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
        const descriptorUpdateExpression =
          isDescriptorDataMissingInTokenGenStates
            ? `, descriptorState = :descriptorState, 
        descriptorAudience = :descriptorAudience, 
        descriptorVoucherLifespan = :descriptorVoucherLifespan`
            : "";

        const input: UpdateItemInput = {
          ConditionExpression: "attribute_exists(PK)",
          Key: {
            PK: {
              S: tokenEntryPK,
            },
          },
          ExpressionAttributeValues: {
            ...agreementExpressionAttributeValues,
            ...descriptorExpressionAttributeValues,
            ":newState": {
              S: purposeState,
            },
            ":newPurposeVersionId": {
              S: purposeVersionId,
            },
            ":gsiPKConsumerIdEServiceId": {
              S: GSIPK_consumerId_eserviceId,
            },
            ":purposeConsumerId": {
              S: purpose.consumerId,
            },
            ":newUpdatedAt": {
              S: new Date().toISOString(),
            },
          },
          UpdateExpression:
            "SET consumerId = :purposeConsumerId, purposeState = :newState, purposeVersionId = :newPurposeVersionId, GSIPK_consumerId_eserviceId = :gsiPKConsumerIdEServiceId, updatedAt = :newUpdatedAt" +
            agreementUpdateExpression +
            descriptorUpdateExpression,
          TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
          ReturnValues: "NONE",
        };
        const command = new UpdateItemCommand(input);
        await dynamoDBClient.send(command);
        logger.info(
          `Token-generation-states. Updated entry ${tokenEntryPK} with purpose and platform-states data`
        );
      }

      exclusiveStartKey = lastEvaluatedKey;
    } while (exclusiveStartKey);
  };

export const updatePurposeDataInTokenGenStatesEntries = async ({
  dynamoDBClient,
  purposeId,
  purposeState,
  purposeVersionId,
  purposeConsumerId,
  logger,
}: {
  dynamoDBClient: DynamoDBClient;
  purposeId: PurposeId;
  purposeState: ItemState;
  purposeVersionId: PurposeVersionId;
  purposeConsumerId: TenantId;
  logger: Logger;
}): Promise<void> => {
  // eslint-disable-next-line functional/no-let
  let exclusiveStartKey: Record<string, AttributeValue> | undefined;

  do {
    const { tokenGenStatesEntries, lastEvaluatedKey } =
      await readTokenGenStatesEntriesByGSIPKPurposeId(
        dynamoDBClient,
        purposeId,
        exclusiveStartKey
      );

    for (const entry of tokenGenStatesEntries) {
      const input: UpdateItemInput = {
        ConditionExpression: "attribute_exists(PK)",
        Key: {
          PK: {
            S: entry.PK,
          },
        },
        ExpressionAttributeValues: {
          ":purposeConsumerId": {
            S: purposeConsumerId,
          },
          ":newState": {
            S: purposeState,
          },
          ":newPurposeVersionId": {
            S: purposeVersionId,
          },
          ":newUpdatedAt": {
            S: new Date().toISOString(),
          },
        },
        UpdateExpression:
          "SET consumerId = :purposeConsumerId, purposeState = :newState, updatedAt = :newUpdatedAt, purposeVersionId = :newPurposeVersionId",
        TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
        ReturnValues: "NONE",
      };
      const command = new UpdateItemCommand(input);
      await dynamoDBClient.send(command);
      logger.info(`Token-generation-states. Updated entry ${entry.PK}`);
    }

    exclusiveStartKey = lastEvaluatedKey;
  } while (exclusiveStartKey);
};

const readAgreementEntry = async (
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
  const data = await dynamoDBClient.send(command);

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

const readCatalogEntry = async (
  dynamoDBClient: DynamoDBClient,
  primaryKey: PlatformStatesEServiceDescriptorPK
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

export const getLastSuspendedOrActivatedPurposeVersion = (
  purposeVersions: PurposeVersion[]
): PurposeVersion => {
  const purposeVersion = purposeVersions.find(
    (v) =>
      v.state === purposeVersionState.active ||
      v.state === purposeVersionState.suspended
  );
  if (!purposeVersion) {
    throw genericInternalError(
      `Unable to find last suspended or activated purpose version. Purpose versions: ${JSON.stringify(
        purposeVersions
      )}`
    );
  }
  return purposeVersion;
};

export const getLastArchivedPurposeVersion = (
  purposeVersions: PurposeVersion[]
): PurposeVersion =>
  purposeVersions
    .filter((v) => v.state === purposeVersionState.archived)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
