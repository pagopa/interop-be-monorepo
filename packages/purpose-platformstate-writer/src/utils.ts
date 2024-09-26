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
  DescriptorId,
  genericInternalError,
  GSIPKConsumerIdEServiceId,
  itemState,
  ItemState,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKEServiceIdDescriptorId,
  makePlatformStatesEServiceDescriptorPK,
  PlatformStatesAgreementEntry,
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
  unsafeBrandId,
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
  purposeId: PurposeId
): Promise<TokenGenerationStatesClientPurposeEntry[]> => {
  const runPaginatedQuery = async (
    purposeId: PurposeId,
    dynamoDBClient: DynamoDBClient,
    exclusiveStartKey?: Record<string, AttributeValue>
  ): Promise<TokenGenerationStatesClientPurposeEntry[]> => {
    const input: QueryInput = {
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      IndexName: "GSIPK_purposeId",
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

      if (!data.LastEvaluatedKey) {
        return tokenStateEntries.data;
      } else {
        return [
          ...tokenStateEntries.data,
          ...(await runPaginatedQuery(
            purposeId,
            dynamoDBClient,
            data.LastEvaluatedKey
          )),
        ];
      }
    }
  };

  return await runPaginatedQuery(purposeId, dynamoDBClient, undefined);
};

export const updatePurposeDataInPlatformStatesEntry = async ({
  dynamoDBClient,
  primaryKey,
  purposeState,
  version,
  purposeVersionId,
}: {
  dynamoDBClient: DynamoDBClient;
  primaryKey: PlatformStatesPurposePK;
  purposeState: ItemState;
  version: number;
  purposeVersionId?: PurposeVersionId;
}): Promise<void> => {
  const {
    purposeVersionIdExpressionAttributeValues,
    purposeVersionIdUpdateExpression,
  } = getPurposeVersionIdUpdateQueryData(purposeVersionId);

  const input: UpdateItemInput = {
    ConditionExpression: "attribute_exists(PK)",
    Key: {
      PK: {
        S: primaryKey,
      },
    },
    ExpressionAttributeValues: {
      ...purposeVersionIdExpressionAttributeValues,
      ":newState": {
        S: purposeState,
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
      "SET #state = :newState, version = :newVersion, updatedAt = :newUpdateAt" +
      purposeVersionIdUpdateExpression,
    TableName: config.tokenGenerationReadModelTableNamePlatform,
    ReturnValues: "NONE",
  };
  const command = new UpdateItemCommand(input);
  await dynamoDBClient.send(command);
};

export const updatePurposeEntriesInTokenGenerationStatesTable = async (
  dynamoDBClient: DynamoDBClient,
  purpose: Purpose,
  purposeState: ItemState,
  purposeVersionId: PurposeVersionId
): Promise<void> => {
  const entriesToUpdate = await readTokenEntriesByGSIPKPurposeId(
    dynamoDBClient,
    purpose.id
  );
  const gsiPKConsumerIdEServiceId = makeGSIPKConsumerIdEServiceId({
    consumerId: purpose.consumerId,
    eserviceId: purpose.eserviceId,
  });
  const platformAgreementEntry =
    await readPlatformAgreementEntryByGSIPKConsumerIdEServiceId(
      dynamoDBClient,
      gsiPKConsumerIdEServiceId
    );
  const catalogEntry = platformAgreementEntry
    ? await readCatalogEntry(
        dynamoDBClient,
        makePlatformStatesEServiceDescriptorPK({
          eserviceId: purpose.eserviceId,
          descriptorId: unsafeBrandId<DescriptorId>(
            platformAgreementEntry.agreementDescriptorId
          ),
        })
      )
    : undefined;

  for (const entry of entriesToUpdate) {
    const tokenEntryPK = entry.PK;
    const isAgreementMissingInTokenTable =
      platformAgreementEntry &&
      (!entry.GSIPK_consumerId_eserviceId ||
        !entry.agreementId ||
        !entry.agreementState);

    // TODO: should the data from platform-states overwrite the data from token-generation-states?
    // Agreement data from platform-states
    const agreementExpressionAttributeValues: Record<string, AttributeValue> =
      isAgreementMissingInTokenTable
        ? {
            ":GSIPK_consumerId_eserviceId": {
              S: platformAgreementEntry.GSIPK_consumerId_eserviceId,
            },
            ":agreementId": {
              S: platformAgreementEntry.PK.split("#")[1],
            },
            ":agreementState": {
              S: platformAgreementEntry.state,
            },
          }
        : {};
    const agreementUpdateExpression = isAgreementMissingInTokenTable
      ? `, GSIPK_consumerId_eserviceId = :GSIPK_consumerId_eserviceId, 
      agreementId = :agreementId, 
      agreementState = :agreementState`
      : "";

    // Descriptor data from platform-states
    const isDescriptorDataMissingInTokenTable =
      platformAgreementEntry &&
      catalogEntry &&
      (!entry.GSIPK_eserviceId_descriptorId ||
        !entry.descriptorAudience ||
        !entry.descriptorState);

    const descriptorExpressionAttributeValues: Record<string, AttributeValue> =
      isDescriptorDataMissingInTokenTable
        ? {
            ":GSIPK_eserviceId_descriptorId": {
              S: makeGSIPKEServiceIdDescriptorId({
                eserviceId: purpose.eserviceId,
                descriptorId: unsafeBrandId<DescriptorId>(
                  platformAgreementEntry.agreementDescriptorId
                ),
              }),
            },
            ":descriptorState": {
              S: catalogEntry.state,
            },
            ":descriptorAudience": {
              S: catalogEntry.descriptorAudience,
            },
            ":descriptorVoucherLifespan": {
              N: catalogEntry.descriptorVoucherLifespan.toString(),
            },
          }
        : {};
    const descriptorUpdateExpression = catalogEntry
      ? `, GSIPK_eserviceId_descriptorId = :GSIPK_eserviceId_descriptorId, 
        descriptorState = :descriptorState, 
        descriptorAudience = :descriptorAudience, 
        descriptorVoucherLifespan = :descriptorVoucherLifespan`
      : "";

    const input: UpdateItemInput = {
      ConditionExpression: "attribute_exists(GSIPK_purposeId)",
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
        ":newUpdateAt": {
          S: new Date().toISOString(),
        },
      },
      UpdateExpression:
        "SET purposeState = :newState, purposeVersionId = :newPurposeVersionId, updatedAt = :newUpdateAt" +
        agreementUpdateExpression +
        descriptorUpdateExpression,
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      ReturnValues: "NONE",
    };
    const command = new UpdateItemCommand(input);
    await dynamoDBClient.send(command);
  }
};

export const updatePurposeDataInTokenGenerationStatesTable = async ({
  dynamoDBClient,
  purposeId,
  purposeState,
  purposeVersionId,
}: {
  dynamoDBClient: DynamoDBClient;
  purposeId: PurposeId;
  purposeState: ItemState;
  purposeVersionId?: PurposeVersionId;
}): Promise<void> => {
  const {
    purposeVersionIdExpressionAttributeValues,
    purposeVersionIdUpdateExpression,
  } = getPurposeVersionIdUpdateQueryData(purposeVersionId);

  const entriesToUpdate = await readTokenEntriesByGSIPKPurposeId(
    dynamoDBClient,
    purposeId
  );

  for (const entry of entriesToUpdate) {
    const input: UpdateItemInput = {
      ConditionExpression: "attribute_exists(GSIPK_purposeId)",
      Key: {
        PK: {
          S: entry.PK,
        },
      },
      ExpressionAttributeValues: {
        ...purposeVersionIdExpressionAttributeValues,
        ":newState": {
          S: purposeState,
        },
        ":newUpdateAt": {
          S: new Date().toISOString(),
        },
      },
      UpdateExpression:
        "SET purposeState = :newState, updatedAt = :newUpdateAt" +
        purposeVersionIdUpdateExpression,
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      ReturnValues: "NONE",
    };
    const command = new UpdateItemCommand(input);
    await dynamoDBClient.send(command);
  }
};

export const readPlatformAgreementEntryByGSIPKConsumerIdEServiceId = async (
  dynamoDBClient: DynamoDBClient,
  gsiPKConsumerIdEServiceId: GSIPKConsumerIdEServiceId
): Promise<PlatformStatesAgreementEntry | undefined> => {
  const input: QueryInput = {
    TableName: config.tokenGenerationReadModelTableNamePlatform,
    IndexName: "GSIPK_consumerId_eserviceId",
    KeyConditionExpression: `GSIPK_consumerId_eserviceId = :gsiValue`,
    ExpressionAttributeValues: {
      ":gsiValue": { S: gsiPKConsumerIdEServiceId },
    },
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

// TODO: copied from catalog-platformstate-writer
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

export const getPurposeVersionByPurposeVersionId = (
  purposeVersions: PurposeVersion[],
  purposeVersionId: PurposeVersionId
): PurposeVersion | undefined =>
  purposeVersions.find((v) => v.id === purposeVersionId);

const getPurposeVersionIdUpdateQueryData = (
  purposeVersionId: PurposeVersionId | undefined
): {
  purposeVersionIdExpressionAttributeValues: Record<string, AttributeValue>;
  purposeVersionIdUpdateExpression: string;
} => {
  const purposeVersionIdExpressionAttributeValues: Record<
    string,
    AttributeValue
  > = purposeVersionId
    ? {
        ":newPurposeVersionId": {
          S: purposeVersionId,
        },
      }
    : {};
  const purposeVersionIdUpdateExpression = purposeVersionId
    ? ", purposeVersionId = :newPurposeVersionId"
    : "";

  return {
    purposeVersionIdExpressionAttributeValues,
    purposeVersionIdUpdateExpression,
  };
};
