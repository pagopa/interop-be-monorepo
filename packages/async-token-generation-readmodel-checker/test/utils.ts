import { PutItemCommand, PutItemInput } from "@aws-sdk/client-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import {
  Agreement,
  Client,
  EService,
  Interaction,
  ProducerKeychain,
  ProducerKeychainPlatformStateEntry,
  Purpose,
} from "pagopa-interop-models";
import { afterEach, inject } from "vitest";
import {
  upsertAgreement,
  upsertClient,
  upsertEService,
  upsertProducerKeychain,
  upsertPurpose,
} from "pagopa-interop-readmodel/testUtils";
import { asyncTokenGenerationReadModelServiceBuilder } from "../src/services/asyncTokenGenerationReadModelService.js";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";

const config = inject("tokenGenerationReadModelConfig");

export const { cleanup, readModelDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig")
);

afterEach(cleanup);

if (!config) {
  throw new Error("Config is not defined");
}

export const dynamoDBClient = new DynamoDBClient({
  endpoint: `http://localhost:${config.tokenGenerationReadModelDbPort}`,
  region: "eu-south-1",
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test",
  },
});

export const readModelService = readModelServiceBuilderSQL(readModelDB);
export const asyncTokenGenerationReadModelService =
  asyncTokenGenerationReadModelServiceBuilder(dynamoDBClient);

export const addOneEService = async (eservice: EService): Promise<void> => {
  await upsertEService(readModelDB, eservice, 0);
};

export const addOnePurpose = async (purpose: Purpose): Promise<void> => {
  await upsertPurpose(readModelDB, purpose, 0);
};

export const addOneAgreement = async (agreement: Agreement): Promise<void> => {
  await upsertAgreement(readModelDB, agreement, 0);
};

export const addOneClient = async (client: Client): Promise<void> => {
  await upsertClient(readModelDB, client, 0);
};

export const addOneProducerKeychain = async (
  producerKeychain: ProducerKeychain
): Promise<void> => {
  await upsertProducerKeychain(readModelDB, producerKeychain, 0);
};

export const writeProducerKeychainPlatformStateEntry = async (
  entry: ProducerKeychainPlatformStateEntry
): Promise<void> => {
  const input: PutItemInput = {
    ConditionExpression: "attribute_not_exists(PK)",
    Item: {
      PK: { S: entry.PK },
      publicKey: { S: entry.publicKey },
      producerKeychainId: { S: entry.producerKeychainId },
      producerId: { S: entry.producerId },
      kid: { S: entry.kid },
      eServiceId: { S: entry.eServiceId },
      version: { N: entry.version.toString() },
      updatedAt: { S: entry.updatedAt },
    },
    TableName: "producer-keychain-platform-states",
  };

  await dynamoDBClient.send(new PutItemCommand(input));
};

export const writeInteraction = async (
  interaction: Interaction
): Promise<void> => {
  const input: PutItemInput = {
    ConditionExpression: "attribute_not_exists(PK)",
    Item: {
      PK: { S: interaction.PK },
      interactionId: { S: interaction.interactionId },
      clientId: { S: interaction.clientId },
      purposeId: { S: interaction.purposeId },
      consumerId: { S: interaction.consumerId },
      eServiceId: { S: interaction.eServiceId },
      descriptorId: { S: interaction.descriptorId },
      state: { S: interaction.state },
      ...(interaction.startInteractionTokenIssuedAt
        ? {
            startInteractionTokenIssuedAt: {
              S: interaction.startInteractionTokenIssuedAt,
            },
          }
        : {}),
      ...(interaction.callbackInvocationTokenIssuedAt
        ? {
            callbackInvocationTokenIssuedAt: {
              S: interaction.callbackInvocationTokenIssuedAt,
            },
          }
        : {}),
      ...(interaction.confirmationTokenIssuedAt
        ? {
            confirmationTokenIssuedAt: {
              S: interaction.confirmationTokenIssuedAt,
            },
          }
        : {}),
      updatedAt: { S: interaction.updatedAt },
      ttl: { N: interaction.ttl.toString() },
    },
    TableName: "interactions",
  };

  await dynamoDBClient.send(new PutItemCommand(input));
};
