import {
  DynamoDBClient,
  UpdateItemCommand,
  UpdateItemInput,
} from "@aws-sdk/client-dynamodb";
import { Logger } from "pagopa-interop-commons";
import {
  Agreement,
  AgreementId,
  genericInternalError,
  PlatformStatesAgreementPK,
  TokenGenerationStatesClientKidPK,
  TokenGenerationStatesClientKidPurposePK,
  TenantId,
} from "pagopa-interop-models";
import { config } from "../configs/config.js";
import { ReadModelService } from "../services/readModelService.js";
import { tokenGenerationReadModelServiceBuilder } from "../services/tokenGenerationReadModelService.js";

export async function addProducerIdToTokenGenReadModel(
  dynamoDBClient: DynamoDBClient,
  readModelService: ReadModelService,
  logger: Logger
): Promise<{
  platformStatesUpdateCount: number;
  tokenGenStatesUpdateCount: number;
}> {
  const tokenGenerationService =
    tokenGenerationReadModelServiceBuilder(dynamoDBClient);
  const platformStatesAgreements =
    await tokenGenerationService.readAllPlatformStatesAgreements();
  const tokenGenerationStatesEntries =
    await tokenGenerationService.readAllTokenGenStatesConsumerClients();

  const readModelAgreements =
    await readModelService.getAllReadModelAgreements();

  const readModelAgreementsById = new Map<AgreementId, Agreement>();
  for (const agreement of readModelAgreements) {
    readModelAgreementsById.set(agreement.id, agreement);
  }

  // eslint-disable-next-line functional/no-let
  let platformStatesUpdateCount = 0;
  for (const platformStatesAgreement of platformStatesAgreements) {
    const readModelAgreement = readModelAgreementsById.get(
      platformStatesAgreement.agreementId
    );

    if (!readModelAgreement) {
      throw genericInternalError(
        `Agreement ${platformStatesAgreement.agreementId} not found in the read model`
      );
    }

    if (platformStatesAgreement.producerId !== readModelAgreement.producerId) {
      await addProducerIdToPlatformStatesAgreement(
        dynamoDBClient,
        platformStatesAgreement.PK,
        readModelAgreement.producerId,
        logger
      );
      platformStatesUpdateCount++;
    }
  }

  // eslint-disable-next-line functional/no-let
  let tokenGenStatesUpdateCount = 0;
  for (const tokenGenerationStatesEntry of tokenGenerationStatesEntries) {
    if (!tokenGenerationStatesEntry.agreementId) {
      throw genericInternalError(
        `AgreementId not found in the token-generation-states entry ${tokenGenerationStatesEntry.PK}`
      );
    }
    const readModelAgreement = readModelAgreementsById.get(
      tokenGenerationStatesEntry.agreementId
    );

    if (!readModelAgreement) {
      throw genericInternalError(
        `Agreement ${tokenGenerationStatesEntry.agreementId} not found in the read model`
      );
    }

    if (
      tokenGenerationStatesEntry.producerId !== readModelAgreement.producerId
    ) {
      await addProducerIdToTokenGenStatesEntry(
        dynamoDBClient,
        tokenGenerationStatesEntry.PK,
        readModelAgreement.producerId,
        logger
      );
      tokenGenStatesUpdateCount++;
    }
  }

  return {
    platformStatesUpdateCount,
    tokenGenStatesUpdateCount,
  };
}

export const addProducerIdToPlatformStatesAgreement = async (
  dynamoDBClient: DynamoDBClient,
  primaryKey: PlatformStatesAgreementPK,
  producerId: TenantId,
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
      ":producerId": {
        S: producerId,
      },
      ":newUpdatedAt": {
        S: new Date().toISOString(),
      },
    },
    UpdateExpression: "SET producerId = :producerId, updatedAt = :newUpdatedAt",
    TableName: config.tokenGenerationReadModelTableNamePlatform,
    ReturnValues: "NONE",
  };
  const command = new UpdateItemCommand(input);
  await dynamoDBClient.send(command);
  logger.info(
    `Platform-states. Updated agreement entry ${primaryKey} with producerId ${producerId}`
  );
};

export const addProducerIdToTokenGenStatesEntry = async (
  dynamoDBClient: DynamoDBClient,
  primaryKey:
    | TokenGenerationStatesClientKidPurposePK
    | TokenGenerationStatesClientKidPK,
  producerId: TenantId,
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
      ":producerId": {
        S: producerId,
      },
      ":newUpdatedAt": {
        S: new Date().toISOString(),
      },
    },
    UpdateExpression: "SET producerId = :producerId, updatedAt = :newUpdatedAt",
    TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
    ReturnValues: "NONE",
  };
  const command = new UpdateItemCommand(input);
  await dynamoDBClient.send(command);
  logger.info(
    `Token-generation-states. Updated entry ${primaryKey} with producerId ${producerId}`
  );
};
