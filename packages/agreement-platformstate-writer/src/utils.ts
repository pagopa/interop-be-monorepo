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
  TokenGenStatesConsumerClientGSIAgreement,
  Agreement,
  makePlatformStatesEServiceDescriptorPK,
  makeGSIPKEServiceIdDescriptorId,
  makeGSIPKConsumerIdEServiceId,
  EServiceId,
  TenantId,
  TokenGenerationStatesConsumerClient,
} from "pagopa-interop-models";
import {
  AttributeValue,
  DynamoDBClient,
  GetItemCommand,
  GetItemInput,
  PutItemCommand,
  PutItemInput,
  QueryCommand,
  QueryInput,
  ScanCommand,
  ScanInput,
  UpdateItemCommand,
  UpdateItemInput,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { z } from "zod";
import { Logger } from "pagopa-interop-commons";
import { config } from "./config/config.js";

export const upsertPlatformStatesAgreementEntry = async (
  agreementEntry: PlatformStatesAgreementEntry,
  dynamoDBClient: DynamoDBClient,
  logger: Logger
): Promise<void> => {
  const input: PutItemInput = {
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
      agreementId: {
        S: agreementEntry.agreementId,
      },
      agreementTimestamp: {
        S: agreementEntry.agreementTimestamp,
      },
      agreementDescriptorId: {
        S: agreementEntry.agreementDescriptorId,
      },
      producerId: {
        S: agreementEntry.producerId,
      },
    },
    TableName: config.tokenGenerationReadModelTableNamePlatform,
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
  logger.info(`Platform-states. Upserted agreement entry ${agreementEntry.PK}`);
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

const updateAgreementStateOnTokenGenStatesEntries = async ({
  entriesToUpdate,
  agreementItemState,
  dynamoDBClient,
  logger,
}: {
  entriesToUpdate: Array<
    | TokenGenStatesConsumerClientGSIAgreement
    | TokenGenerationStatesConsumerClient
  >;
  agreementItemState: ItemState;
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
          S: agreementItemState,
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

const updateAgreementStateAndDescriptorInfoOnTokenGenStatesEntries = async ({
  entriesToUpdate,
  agreementId,
  agreementState,
  producerId,
  dynamoDBClient,
  GSIPK_eserviceId_descriptorId,
  catalogEntry,
  logger,
}: {
  entriesToUpdate: TokenGenStatesConsumerClientGSIAgreement[];
  agreementId: AgreementId;
  agreementState: AgreementState;
  producerId: TenantId;
  dynamoDBClient: DynamoDBClient;
  GSIPK_eserviceId_descriptorId: GSIPKEServiceIdDescriptorId;
  catalogEntry: PlatformStatesCatalogEntry | undefined;
  logger: Logger;
}): Promise<void> => {
  for (const entry of entriesToUpdate) {
    // Descriptor info should be filled when the fields are missing or outdated
    const additionalDescriptorInfo =
      catalogEntry &&
      (entry.descriptorState !== catalogEntry.state ||
        entry.descriptorAudience !== catalogEntry.descriptorAudience ||
        entry.descriptorVoucherLifespan !==
          catalogEntry.descriptorVoucherLifespan);

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
        ":producerId": {
          S: producerId,
        },
        ":newUpdatedAt": {
          S: new Date().toISOString(),
        },
        ...additionalAttributesToSet,
      },
      UpdateExpression:
        "SET agreementId = :agreementId, agreementState = :newState, GSIPK_eserviceId_descriptorId = :gsiEServiceIdDescriptorId, producerId = :producerId, updatedAt = :newUpdatedAt".concat(
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

export const updateAgreementStateAndDescriptorInfoOnTokenGenStates = async ({
  GSIPK_consumerId_eserviceId,
  agreementId,
  agreementState,
  producerId,
  dynamoDBClient,
  GSIPK_eserviceId_descriptorId,
  catalogEntry,
  logger,
}: {
  GSIPK_consumerId_eserviceId: GSIPKConsumerIdEServiceId;
  agreementId: AgreementId;
  agreementState: AgreementState;
  producerId: TenantId;
  dynamoDBClient: DynamoDBClient;
  GSIPK_eserviceId_descriptorId: GSIPKEServiceIdDescriptorId;
  catalogEntry: PlatformStatesCatalogEntry | undefined;
  logger: Logger;
}): Promise<void> => {
  // eslint-disable-next-line functional/no-let
  let exclusiveStartKey: Record<string, AttributeValue> | undefined;

  do {
    const input: QueryInput = {
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      IndexName: "Agreement",
      KeyConditionExpression: `GSIPK_consumerId_eserviceId = :gsiValue`,
      ExpressionAttributeValues: {
        ":gsiValue": { S: GSIPK_consumerId_eserviceId },
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
        producerId,
        dynamoDBClient,
        GSIPK_eserviceId_descriptorId,
        catalogEntry,
        logger,
      });

      exclusiveStartKey = data.LastEvaluatedKey;
    }
  } while (exclusiveStartKey);
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
}): Promise<void> => {
  // eslint-disable-next-line functional/no-let
  let exclusiveStartKey: Record<string, AttributeValue> | undefined;

  do {
    const input: QueryInput = {
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      IndexName: "Agreement",
      KeyConditionExpression: `GSIPK_consumerId_eserviceId = :gsiValue`,
      ExpressionAttributeValues: {
        ":gsiValue": { S: GSIPK_consumerId_eserviceId },
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
        agreementItemState: agreementStateToItemState(agreementState),
        dynamoDBClient,
        logger,
      });

      exclusiveStartKey = data.LastEvaluatedKey;
    }
  } while (exclusiveStartKey);
};

const readCatalogEntry = async (
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

export const isLatestAgreement = (
  platformStatesAgreement: PlatformStatesAgreementEntry | undefined,
  currentAgreementTimestamp: string
): boolean => {
  if (!platformStatesAgreement) {
    return true;
  }

  return (
    new Date(currentAgreementTimestamp) >=
    new Date(platformStatesAgreement.agreementTimestamp)
  );
};

export const updateLatestAgreementOnTokenGenStates = async (
  dynamoDBClient: DynamoDBClient,
  agreement: Agreement,
  logger: Logger
): Promise<void> => {
  const processAgreementUpdateOnTokenGenStates = async (
    platformStatesCatalogEntry: PlatformStatesCatalogEntry | undefined,
    consumerId: TenantId,
    eserviceId: EServiceId
  ): Promise<void> => {
    const GSIPK_eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
      eserviceId: agreement.eserviceId,
      descriptorId: agreement.descriptorId,
    });

    await updateAgreementStateAndDescriptorInfoOnTokenGenStates({
      GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId,
      }),
      agreementId: agreement.id,
      agreementState: agreement.state,
      producerId: agreement.producerId,
      dynamoDBClient,
      GSIPK_eserviceId_descriptorId,
      catalogEntry: platformStatesCatalogEntry,
      logger,
    });
  };

  const platformsStatesCatalogEntryPK = makePlatformStatesEServiceDescriptorPK({
    eserviceId: agreement.eserviceId,
    descriptorId: agreement.descriptorId,
  });
  const platformStatesCatalogEntry = await readCatalogEntry(
    platformsStatesCatalogEntryPK,
    dynamoDBClient
  );

  await processAgreementUpdateOnTokenGenStates(
    platformStatesCatalogEntry,
    agreement.consumerId,
    agreement.eserviceId
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
      agreement.consumerId,
      agreement.eserviceId
    );
  } else {
    logger.info(
      `Token-generation-states. Second retrieval of catalog entry ${platformsStatesCatalogEntryPK} didn't bring any updates to agreement with GSIPK_consumerId_eserviceId ${makeGSIPKConsumerIdEServiceId(
        { consumerId: agreement.consumerId, eserviceId: agreement.eserviceId }
      )}`
    );
  }
};

export const updateAgreementStateInPlatformStatesV1 = async (
  agreementId: AgreementId,
  agreementItemState: ItemState,
  msgVersion: number,
  dynamoDBClient: DynamoDBClient,
  logger: Logger
): Promise<void> => {
  // eslint-disable-next-line functional/no-let
  let exclusiveStartKey: Record<string, AttributeValue> | undefined;

  do {
    const readInput: ScanInput = {
      TableName: config.tokenGenerationReadModelTableNamePlatform,
      FilterExpression: "agreementId = :agreementId",
      ExpressionAttributeValues: {
        ":agreementId": { S: agreementId },
      },
      ExclusiveStartKey: exclusiveStartKey,
      ConsistentRead: true,
    };
    const commandQuery = new ScanCommand(readInput);
    const data = await dynamoDBClient.send(commandQuery);

    if (!data.Items) {
      throw genericInternalError(
        `Unable to read platform-states agreement entries: result ${JSON.stringify(
          data
        )} `
      );
    } else {
      const unmarshalledItems = data.Items.map((item) => unmarshall(item));

      const agreementEntries = z
        .array(PlatformStatesAgreementEntry)
        .safeParse(unmarshalledItems);

      if (!agreementEntries.success) {
        throw genericInternalError(
          `Unable to parse platform-states agreement entries: result ${JSON.stringify(
            agreementEntries
          )} - data ${JSON.stringify(data)} `
        );
      }

      for (const entry of agreementEntries.data) {
        await updateAgreementStateInPlatformStatesEntry(
          dynamoDBClient,
          entry.PK,
          agreementItemState,
          msgVersion,
          logger
        );
      }

      exclusiveStartKey = data.LastEvaluatedKey;
    }
  } while (exclusiveStartKey);
};

export const updateAgreementStateInTokenGenStatesV1 = async (
  agreementId: AgreementId,
  agreementItemState: ItemState,
  dynamoDBClient: DynamoDBClient,
  logger: Logger
): Promise<void> => {
  // eslint-disable-next-line functional/no-let
  let exclusiveStartKey: Record<string, AttributeValue> | undefined;

  do {
    const readInput: ScanInput = {
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      FilterExpression: "agreementId = :agreementId",
      ExpressionAttributeValues: {
        ":agreementId": { S: agreementId },
      },
      ExclusiveStartKey: exclusiveStartKey,
      ConsistentRead: true,
    };
    const commandQuery = new ScanCommand(readInput);
    const data = await dynamoDBClient.send(commandQuery);

    if (!data.Items) {
      throw genericInternalError(
        `Unable to read token-generation-states entries with agreement id ${agreementId}: result ${JSON.stringify(
          data
        )} `
      );
    } else {
      const unmarshalledItems = data.Items.map((item) => unmarshall(item));

      const consumerClients = z
        .array(TokenGenerationStatesConsumerClient)
        .safeParse(unmarshalledItems);

      if (!consumerClients.success) {
        throw genericInternalError(
          `Unable to parse token-generation-states entries with agreement id ${agreementId}: result ${JSON.stringify(
            consumerClients
          )} - data ${JSON.stringify(data)} `
        );
      }

      await updateAgreementStateOnTokenGenStatesEntries({
        entriesToUpdate: consumerClients.data,
        agreementItemState,
        dynamoDBClient,
        logger,
      });

      exclusiveStartKey = data.LastEvaluatedKey;
    }
  } while (exclusiveStartKey);
};

export const extractAgreementTimestamp = (agreement: Agreement): string =>
  agreement.stamps.upgrade?.when.toISOString() ||
  agreement.stamps.activation?.when.toISOString() ||
  agreement.createdAt.toISOString();
