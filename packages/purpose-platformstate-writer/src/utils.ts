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
  EServiceId,
  fromPurposeV2,
  genericInternalError,
  GSIPKConsumerIdEServiceId,
  itemState,
  ItemState,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKEServiceIdDescriptorId,
  makePlatformStatesEServiceDescriptorPK,
  makePlatformStatesPurposePK,
  missingKafkaMessageDataError,
  PlatformStatesAgreementEntry,
  PlatformStatesCatalogEntry,
  PlatformStatesEServiceDescriptorPK,
  PlatformStatesPurposeEntry,
  PlatformStatesPurposePK,
  Purpose,
  PurposeEventEnvelopeV2,
  PurposeId,
  PurposeV2,
  PurposeVersion,
  PurposeVersionId,
  TokenGenerationStatesClientKidPurposePK,
  TokenGenerationStatesClientPurposeEntry,
  unsafeBrandId,
} from "pagopa-interop-models";
import { z } from "zod";
import { config } from "./config/config.js";

export const purposeStateToItemState = (purpose: Purpose): ItemState =>
  purpose.suspendedByConsumer && purpose.suspendedByProducer
    ? itemState.inactive
    : itemState.active;

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

// TODO: very similar method: deleteCatalogEntry
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

export const readTokenEntriesByPurposeId = async (
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

// TODO: should this be an upsert?
export const updatePurposeStateInPlatformStatesEntry = async (
  dynamoDBClient: DynamoDBClient,
  primaryKey: PlatformStatesPurposePK,
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

export const updatePurposeEntriesInTokenGenerationStatesTable = async (
  dynamoDBClient: DynamoDBClient,
  purpose: Purpose
): Promise<void> => {
  const entriesToUpdate = await readTokenEntriesByPurposeId(
    dynamoDBClient,
    purpose.id
  );

  // if (!entriesToUpdate) {
  //   // TODO: add record with only purpose data
  // } else {
  for (const entry of entriesToUpdate) {
    const tokenEntryPK = entry.PK;

    // Update token entry with agreement data from platform-states if they're missing AND purposeState is not undefined
    const gsiPKConsumerIdEServiceId = makeGSIPKConsumerIdEServiceId({
      consumerId: purpose.consumerId,
      eserviceId: purpose.eserviceId,
    });

    // TODO should this only add the data if it's not already there?
    if (
      (!entry.GSIPK_consumerId_eserviceId ||
        !entry.agreementId ||
        !entry.agreementState) &&
      entry.purposeState
    ) {
      const platformAgreementEntry =
        await readPlatformAgreementEntryByGSIPKConsumerIdEServiceId(
          dynamoDBClient,
          gsiPKConsumerIdEServiceId
        );

      if (platformAgreementEntry) {
        await updateTokenPurposeEntryWithAgreementData(
          dynamoDBClient,
          tokenEntryPK,
          platformAgreementEntry
        );

        // Update token entry with descriptor data from platform-states if they're missing
        const descriptorId = platformAgreementEntry.agreementDescriptorId;
        if (
          !entry.GSIPK_eserviceId_descriptorId ||
          !entry.descriptorAudience ||
          !entry.descriptorState
        ) {
          const platformDescriptorPK = makePlatformStatesEServiceDescriptorPK({
            eserviceId: purpose.eserviceId,
            descriptorId: unsafeBrandId<DescriptorId>(descriptorId),
          });
          const catalogEntry = await readCatalogEntry(
            dynamoDBClient,
            platformDescriptorPK
          );

          if (catalogEntry) {
            await updateTokenPurposeEntryWithDescriptorData(
              dynamoDBClient,
              tokenEntryPK,
              catalogEntry
            );
          }
        }
      }
    }

    // Update token entry with new purpose state
    const purposeState = purposeStateToItemState(purpose);
    await updatePurposeStateInTokenGenerationStatesTable(
      dynamoDBClient,
      tokenEntryPK,
      purposeState
    );
  }
  // }
};

export const updatePurposeStatesInTokenGenerationStatesTable = async (
  dynamoDBClient: DynamoDBClient,
  purpose: Purpose
): Promise<void> => {
  const purposeState = purposeStateToItemState(purpose);
  const entriesToUpdate = await readTokenEntriesByPurposeId(
    dynamoDBClient,
    purpose.id
  );

  if (!entriesToUpdate) {
    // TODO: add record with only purpose data
  } else {
    for (const entry of entriesToUpdate) {
      await updatePurposeStateInTokenGenerationStatesTable(
        dynamoDBClient,
        entry.PK,
        purposeState
      );
    }
  }
};

export const updatePurposeStateInTokenGenerationStatesTable = async (
  dynamoDBClient: DynamoDBClient,
  primaryKey: TokenGenerationStatesClientKidPurposePK,
  purposeState: ItemState
): Promise<void> => {
  const input: UpdateItemInput = {
    ConditionExpression: "attribute_exists(GSIPK_purposeId)",
    Key: {
      PK: {
        S: primaryKey,
      },
    },
    ExpressionAttributeValues: {
      ":newState": {
        S: purposeState,
      },
      ":newUpdateAt": {
        S: new Date().toISOString(),
      },
    },
    UpdateExpression: "SET purposeState = :newState, updatedAt = :newUpdateAt",
    TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
    ReturnValues: "NONE",
  };
  const command = new UpdateItemCommand(input);
  await dynamoDBClient.send(command);
};

export const updateTokenPurposeEntryWithDescriptorData = async (
  dynamoDBClient: DynamoDBClient,
  primaryKey: TokenGenerationStatesClientKidPurposePK,
  catalogEntry: PlatformStatesCatalogEntry
): Promise<void> => {
  const splitCatalogPK = catalogEntry.PK.split("#");
  const eserviceId: EServiceId = unsafeBrandId(splitCatalogPK[1]);
  const descriptorId: DescriptorId = unsafeBrandId(splitCatalogPK[2]);
  const gsiPKEServiceIdDescriptorId = makeGSIPKEServiceIdDescriptorId({
    eserviceId,
    descriptorId,
  });
  const input: UpdateItemInput = {
    ConditionExpression: "attribute_exists(GSIPK_purposeId)",
    Key: {
      PK: {
        S: primaryKey,
      },
    },
    ExpressionAttributeValues: {
      ":GSIPK_eserviceId_descriptorId": {
        S: gsiPKEServiceIdDescriptorId,
      },
      ":descriptorState": {
        S: catalogEntry.state,
      },
      ":descriptorAudience": {
        S: catalogEntry.descriptorAudience,
      },
      ":newUpdateAt": {
        S: new Date().toISOString(),
      },
    },
    UpdateExpression:
      "SET GSIPK_eserviceId_descriptorId = :GSIPK_eserviceId_descriptorId, descriptorState = :descriptorState, descriptorAudience = :descriptorAudience, updatedAt = :newUpdateAt",
    TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
    ReturnValues: "NONE",
  };
  const command = new UpdateItemCommand(input);
  await dynamoDBClient.send(command);
};

export const updateTokenPurposeEntryWithAgreementData = async (
  dynamoDBClient: DynamoDBClient,
  primaryKey: TokenGenerationStatesClientKidPurposePK,
  agreementPlatformEntry: PlatformStatesAgreementEntry
): Promise<void> => {
  const input: UpdateItemInput = {
    ConditionExpression: "attribute_exists(GSIPK_purposeId)",
    Key: {
      PK: {
        S: primaryKey,
      },
    },
    ExpressionAttributeValues: {
      ":GSIPK_consumerId_eserviceId": {
        S: agreementPlatformEntry.GSIPK_consumerId_eserviceId,
      },
      ":agreementId": {
        S: agreementPlatformEntry.PK.split("#")[1],
      },
      ":agreementState": {
        S: agreementPlatformEntry.state,
      },
      ":newUpdateAt": {
        S: new Date().toISOString(),
      },
    },
    UpdateExpression:
      "SET GSIPK_consumerId_eserviceId = :GSIPK_consumerId_eserviceId, agreementId = :agreementId, agreementState = :agreementState, updatedAt = :newUpdateAt",
    TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
    ReturnValues: "NONE",
  };
  const command = new UpdateItemCommand(input);
  await dynamoDBClient.send(command);
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
      return platformAgreementEntries.data
        .slice()
        .sort(
          (a, b) =>
            Date.parse(b.GSISK_agreementTimestamp) -
            Date.parse(a.GSISK_agreementTimestamp)
        )[0];
    } else {
      throw genericInternalError(
        `Unable to read platform state entries: result ${JSON.stringify(
          platformAgreementEntries
        )} `
      );
    }
  }
};

// TODO: should create generic function to update?
export const updatePurposeVersionIdInPlatformStatesEntry = async (
  dynamoDBClient: DynamoDBClient,
  primaryKey: PlatformStatesPurposePK,
  purposeVersionId: PurposeVersionId,
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
      ":newPurposeVersionId": {
        S: purposeVersionId,
      },
      ":newVersion": {
        N: version.toString(),
      },
      ":newUpdateAt": {
        S: new Date().toISOString(),
      },
    },
    UpdateExpression:
      "SET purposeVersionId = :newPurposeVersionId, version = :newVersion, updatedAt = :newUpdateAt",
    TableName: config.tokenGenerationReadModelTableNamePlatform,
    ReturnValues: "NONE",
  };
  const command = new UpdateItemCommand(input);
  await dynamoDBClient.send(command);
};

export const updatePurposeVersionIdInTokenGenerationStatesTable = async (
  dynamoDBClient: DynamoDBClient,
  purpose: Purpose,
  purposeVersionId: PurposeVersionId
): Promise<void> => {
  const entriesToUpdate = await readTokenEntriesByPurposeId(
    dynamoDBClient,
    purpose.id
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
        ":newPurposeVersionId": {
          S: purposeVersionId,
        },
        ":newUpdateAt": {
          S: new Date().toISOString(),
        },
      },
      UpdateExpression:
        "SET purposeVersionId = :newPurposeVersionId, updatedAt = :newUpdateAt",
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      ReturnValues: "NONE",
    };
    const command = new UpdateItemCommand(input);
    await dynamoDBClient.send(command);
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

export const getPurposeDataFromMessage = async (
  dynamoDBClient: DynamoDBClient,
  msg: PurposeEventEnvelopeV2
): Promise<{
  purpose: Purpose;
  primaryKey: PlatformStatesPurposePK;
  purposeState: ItemState;
  existingPurposeEntry?: PlatformStatesPurposeEntry;
}> => {
  const purpose = getPurposeFromEvent(msg, msg.type);
  const primaryKey = makePlatformStatesPurposePK(unsafeBrandId(purpose.id));
  const purposeState = purposeStateToItemState(purpose);

  const existingPurposeEntry = await readPlatformPurposeEntry(
    dynamoDBClient,
    primaryKey
  );
  return { purpose, primaryKey, purposeState, existingPurposeEntry };
};

// TODO: copied from /interop-be-monorepo/packages/authorization-updater/src/utils.ts. Maybe move to a common place?
export const getPurposeFromEvent = (
  msg: {
    data: {
      purpose?: PurposeV2;
    };
  },
  eventType: string
): Purpose => {
  if (!msg.data.purpose) {
    throw missingKafkaMessageDataError("purpose", eventType);
  }

  return fromPurposeV2(msg.data.purpose);
};

// TODO: copied from /interop-be-monorepo/packages/authorization-updater/src/utils.ts. Maybe move to a common place?
export const getPurposeVersionFromEvent = (
  msg: {
    data: {
      purpose?: PurposeV2;
      versionId: string;
    };
  },
  eventType: string
): PurposeVersion => {
  const purpose = getPurposeFromEvent(msg, eventType);
  const purposeVersion = purpose.versions.find(
    (v) => v.id === msg.data.versionId
  );

  if (!purposeVersion) {
    throw missingKafkaMessageDataError("purposeVersion", eventType);
  }

  return purposeVersion;
};
