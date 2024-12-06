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
import {
  AgreementId,
  genericInternalError,
  GSIPKConsumerIdEServiceId,
  itemState,
  ItemState,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKEServiceIdDescriptorId,
  makePlatformStatesEServiceDescriptorPK,
  PlatformStatesAgreementGSIAgreement,
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

export const writePlatformPurposeEntry = async (
  dynamoDBClient: DynamoDBClient,
  purposeEntry: PlatformStatesPurposeEntry
): Promise<void> => {
  const input: PutItemInput = {
    ConditionExpression: "attribute_not_exists(PK)",
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
  };
  const command = new GetItemCommand(input);
  const data: GetItemCommandOutput = await dynamoDBClient.send(command);

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
  primaryKey: PlatformStatesPurposePK
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
}: {
  dynamoDBClient: DynamoDBClient;
  primaryKey: PlatformStatesPurposePK;
  purposeState: ItemState;
  purposeVersionId: PurposeVersionId;
  version: number;
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
};

export const updateTokenGenStatesEntriesWithPurposeAndPlatformStatesData =
  async (
    dynamoDBClient: DynamoDBClient,
    purpose: Purpose,
    purposeState: ItemState,
    purposeVersionId: PurposeVersionId,
    logger: Logger
  ): Promise<void> => {
    const runPaginatedUpdateQuery = async (
      dynamoDBClient: DynamoDBClient,
      purpose: Purpose,
      purposeState: ItemState,
      purposeVersionId: PurposeVersionId,
      exclusiveStartKey?: Record<string, AttributeValue>
      // eslint-disable-next-line sonarjs/cognitive-complexity
    ): Promise<void> => {
      const result = await readTokenGenStatesEntriesByGSIPKPurposeId(
        dynamoDBClient,
        purpose.id,
        exclusiveStartKey
      );
      const gsiPKConsumerIdEServiceId = makeGSIPKConsumerIdEServiceId({
        consumerId: purpose.consumerId,
        eserviceId: purpose.eserviceId,
      });

      const platformAgreementEntry = await readPlatformAgreementEntry(
        dynamoDBClient,
        gsiPKConsumerIdEServiceId
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

      for (const entry of result.tokenGenStatesEntries) {
        const tokenEntryPK = entry.PK;
        const isAgreementMissingInTokenGenStates =
          !!platformAgreementEntry &&
          !!gsiPKEServiceIdDescriptorId &&
          (!entry.agreementId ||
            !entry.agreementState ||
            !entry.GSIPK_eserviceId_descriptorId);

        if (isAgreementMissingInTokenGenStates) {
          logger.info(
            `Adding agreement info to token-generation-states entry with PK ${tokenEntryPK} and GSIPK_consumerId_eserviceId ${gsiPKConsumerIdEServiceId}`
          );
        }
        // Agreement data from platform-states
        const agreementExpressionAttributeValues: Record<
          string,
          AttributeValue
        > = isAgreementMissingInTokenGenStates
          ? {
              ":agreementId": {
                S: extractAgreementIdFromAgreementPK(platformAgreementEntry.PK),
              },
              ":agreementState": {
                S: platformAgreementEntry.state,
              },
              ":gsiPKEServiceIdDescriptorId": {
                S: gsiPKEServiceIdDescriptorId,
              },
            }
          : {};
        const agreementUpdateExpression = isAgreementMissingInTokenGenStates
          ? `, agreementId = :agreementId, 
      agreementState = :agreementState, 
      GSIPK_eserviceId_descriptorId = :gsiPKEServiceIdDescriptorId`
          : "";

        // Descriptor data from platform-states
        const isDescriptorDataMissingInTokenGenStates =
          !!platformAgreementEntry &&
          !!catalogEntry &&
          (!entry.descriptorAudience ||
            !entry.descriptorState ||
            !entry.descriptorVoucherLifespan);

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
              S: makeGSIPKConsumerIdEServiceId({
                consumerId: purpose.consumerId,
                eserviceId: purpose.eserviceId,
              }),
            },
            ":newUpdatedAt": {
              S: new Date().toISOString(),
            },
          },
          UpdateExpression:
            "SET purposeState = :newState, purposeVersionId = :newPurposeVersionId, GSIPK_consumerId_eserviceId = :gsiPKConsumerIdEServiceId, updatedAt = :newUpdatedAt" +
            agreementUpdateExpression +
            descriptorUpdateExpression,
          TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
          ReturnValues: "NONE",
        };
        const command = new UpdateItemCommand(input);
        await dynamoDBClient.send(command);
      }

      if (result.lastEvaluatedKey) {
        await runPaginatedUpdateQuery(
          dynamoDBClient,
          purpose,
          purposeState,
          purposeVersionId,
          result.lastEvaluatedKey
        );
      }
    };

    await runPaginatedUpdateQuery(
      dynamoDBClient,
      purpose,
      purposeState,
      purposeVersionId
    );
  };

export const updatePurposeDataInTokenGenStatesEntries = async ({
  dynamoDBClient,
  purposeId,
  purposeState,
  purposeVersionId,
}: {
  dynamoDBClient: DynamoDBClient;
  purposeId: PurposeId;
  purposeState: ItemState;
  purposeVersionId: PurposeVersionId;
}): Promise<void> => {
  const runPaginatedUpdateQuery = async (
    dynamoDBClient: DynamoDBClient,
    purposeId: PurposeId,
    purposeState: ItemState,
    purposeVersionId: PurposeVersionId,
    exclusiveStartKey?: Record<string, AttributeValue>
  ): Promise<void> => {
    const result = await readTokenGenStatesEntriesByGSIPKPurposeId(
      dynamoDBClient,
      purposeId,
      exclusiveStartKey
    );

    for (const entry of result.tokenGenStatesEntries) {
      const input: UpdateItemInput = {
        ConditionExpression: "attribute_exists(PK)",
        Key: {
          PK: {
            S: entry.PK,
          },
        },
        ExpressionAttributeValues: {
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
          "SET purposeState = :newState, updatedAt = :newUpdatedAt, purposeVersionId = :newPurposeVersionId",
        TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
        ReturnValues: "NONE",
      };
      const command = new UpdateItemCommand(input);
      await dynamoDBClient.send(command);
    }

    if (result.lastEvaluatedKey) {
      await runPaginatedUpdateQuery(
        dynamoDBClient,
        purposeId,
        purposeState,
        purposeVersionId,
        result.lastEvaluatedKey
      );
    }
  };

  await runPaginatedUpdateQuery(
    dynamoDBClient,
    purposeId,
    purposeState,
    purposeVersionId
  );
};

export const readPlatformAgreementEntry = async (
  dynamoDBClient: DynamoDBClient,
  gsiPKConsumerIdEServiceId: GSIPKConsumerIdEServiceId
): Promise<PlatformStatesAgreementGSIAgreement | undefined> => {
  const input: QueryInput = {
    TableName: config.tokenGenerationReadModelTableNamePlatform,
    IndexName: "Agreement",
    KeyConditionExpression: `GSIPK_consumerId_eserviceId = :gsiValue`,
    ExpressionAttributeValues: {
      ":gsiValue": { S: gsiPKConsumerIdEServiceId },
    },
    ScanIndexForward: false,
  };
  const command = new QueryCommand(input);
  const data: QueryCommandOutput = await dynamoDBClient.send(command);

  if (!data.Items) {
    return undefined;
  } else {
    const unmarshalledItems = data.Items.map((item) => unmarshall(item));
    const platformAgreementEntries = z
      .array(PlatformStatesAgreementGSIAgreement)
      .safeParse(unmarshalledItems);

    if (platformAgreementEntries.success) {
      return platformAgreementEntries.data[0];
    } else {
      throw genericInternalError(
        `Unable to parse platform-states agreement entries: result ${JSON.stringify(
          platformAgreementEntries
        )} `
      );
    }
  }
};

export const readCatalogEntry = async (
  dynamoDBClient: DynamoDBClient,
  primaryKey: PlatformStatesEServiceDescriptorPK
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

const extractAgreementIdFromAgreementPK = (
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
