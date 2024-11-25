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
  TokenGenerationStatesClientPurposeEntry,
} from "pagopa-interop-models";
import { z } from "zod";
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
        `Unable to parse purpose entry item: result ${JSON.stringify(
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

export const readTokenEntriesByGSIPKPurposeId = async (
  dynamoDBClient: DynamoDBClient,
  purposeId: PurposeId,
  exclusiveStartKey?: Record<string, AttributeValue>
): Promise<{
  tokenStateEntries: TokenGenerationStatesClientPurposeEntry[];
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

    return {
      tokenStateEntries: tokenStateEntries.data,
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

export const updateTokenEntriesWithPurposeAndPlatformStatesData = async (
  dynamoDBClient: DynamoDBClient,
  purpose: Purpose,
  purposeState: ItemState,
  purposeVersionId: PurposeVersionId
): Promise<void> => {
  const runPaginatedUpdateQuery = async (
    dynamoDBClient: DynamoDBClient,
    purpose: Purpose,
    purposeState: ItemState,
    purposeVersionId: PurposeVersionId,
    exclusiveStartKey?: Record<string, AttributeValue>
  ): Promise<void> => {
    const result = await readTokenEntriesByGSIPKPurposeId(
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
    const catalogEntry = platformAgreementEntry
      ? await readCatalogEntry(
          dynamoDBClient,
          makePlatformStatesEServiceDescriptorPK({
            eserviceId: purpose.eserviceId,
            descriptorId: platformAgreementEntry.agreementDescriptorId,
          })
        )
      : undefined;

    for (const entry of result.tokenStateEntries) {
      const tokenEntryPK = entry.PK;
      const isAgreementMissingInTokenTable =
        platformAgreementEntry &&
        (!entry.agreementId ||
          !entry.agreementState ||
          !entry.GSIPK_eserviceId_descriptorId);

      // Agreement data from platform-states
      const agreementExpressionAttributeValues: Record<string, AttributeValue> =
        isAgreementMissingInTokenTable
          ? {
              ":agreementId": {
                S: extractAgreementIdFromAgreementPK(platformAgreementEntry.PK),
              },
              ":agreementState": {
                S: platformAgreementEntry.state,
              },
              ":GSIPK_eserviceId_descriptorId": {
                S: makeGSIPKEServiceIdDescriptorId({
                  eserviceId: purpose.eserviceId,
                  descriptorId: platformAgreementEntry.agreementDescriptorId,
                }),
              },
            }
          : {};
      const agreementUpdateExpression = isAgreementMissingInTokenTable
        ? `, agreementId = :agreementId, 
      agreementState = :agreementState, 
      GSIPK_eserviceId_descriptorId = :GSIPK_eserviceId_descriptorId`
        : "";

      // Descriptor data from platform-states
      const isDescriptorDataMissingInTokenTable =
        platformAgreementEntry &&
        catalogEntry &&
        (!entry.descriptorAudience ||
          !entry.descriptorState ||
          !entry.descriptorVoucherLifespan);

      const descriptorExpressionAttributeValues: Record<
        string,
        AttributeValue
      > = isDescriptorDataMissingInTokenTable
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
      const descriptorUpdateExpression = isDescriptorDataMissingInTokenTable
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
          ":GSIPK_consumerId_eserviceId": {
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
          "SET purposeState = :newState, purposeVersionId = :newPurposeVersionId, GSIPK_consumerId_eserviceId = :GSIPK_consumerId_eserviceId, updatedAt = :newUpdatedAt" +
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

export const updatePurposeDataInTokenEntries = async ({
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
    const result = await readTokenEntriesByGSIPKPurposeId(
      dynamoDBClient,
      purposeId,
      exclusiveStartKey
    );

    for (const entry of result.tokenStateEntries) {
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
): Promise<PlatformStatesAgreementEntry | undefined> => {
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
      .array(PlatformStatesAgreementEntry)
      .safeParse(unmarshalledItems);

    if (platformAgreementEntries.success) {
      return platformAgreementEntries.data[0];
    } else {
      throw genericInternalError(
        `Unable to parse platform agreement entries: result ${JSON.stringify(
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
        `Unable to parse catalog entry item: result ${JSON.stringify(
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
