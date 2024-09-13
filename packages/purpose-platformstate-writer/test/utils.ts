/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { fail } from "assert";
import {
  DynamoDBClient,
  PutItemCommand,
  PutItemInput,
} from "@aws-sdk/client-dynamodb";
import { setupTestContainersVitest } from "pagopa-interop-commons-test/index.js";
import { TokenGenerationStatesClientPurposeEntry } from "pagopa-interop-models";
import { afterEach, inject } from "vitest";

export const config = inject("tokenGenerationReadModelConfig");
export const { cleanup } = setupTestContainersVitest();

afterEach(cleanup);

// TODO: same function as catalog-platformstate-writer
export const writeTokenStateEntry = async (
  tokenStateEntry: TokenGenerationStatesClientPurposeEntry,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  if (!config) {
    fail();
  }
  const input: PutItemInput = {
    ConditionExpression: "attribute_not_exists(PK)",
    Item: {
      PK: {
        S: tokenStateEntry.PK,
      },
      descriptorState: {
        S: tokenStateEntry.descriptorState!,
      },
      descriptorAudience: {
        S: tokenStateEntry.descriptorAudience!,
      },
      updatedAt: {
        S: tokenStateEntry.updatedAt,
      },
      consumerId: {
        S: tokenStateEntry.consumerId,
      },
      agreementId: {
        S: tokenStateEntry.agreementId!,
      },
      purposeVersionId: {
        S: tokenStateEntry.purposeVersionId!,
      },
      GSIPK_consumerId_eserviceId: {
        S: tokenStateEntry.GSIPK_consumerId_eserviceId!,
      },
      clientKind: {
        S: tokenStateEntry.clientKind,
      },
      publicKey: {
        S: tokenStateEntry.publicKey,
      },
      GSIPK_clientId: {
        S: tokenStateEntry.GSIPK_clientId,
      },
      GSIPK_kid: {
        S: tokenStateEntry.GSIPK_kid,
      },
      GSIPK_clientId_purposeId: {
        S: tokenStateEntry.GSIPK_clientId_purposeId!,
      },
      agreementState: {
        S: tokenStateEntry.agreementState!,
      },
      GSIPK_eserviceId_descriptorId: {
        S: tokenStateEntry.GSIPK_eserviceId_descriptorId!,
      },
      GSIPK_purposeId: {
        S: tokenStateEntry.GSIPK_purposeId!,
      },
      purposeState: {
        S: tokenStateEntry.purposeState!,
      },
    },
    TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
};
