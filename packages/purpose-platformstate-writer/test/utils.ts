/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { fail } from "assert";
import {
  DynamoDBClient,
  GetItemCommand,
  GetItemCommandOutput,
  GetItemInput,
  PutItemCommand,
  PutItemInput,
} from "@aws-sdk/client-dynamodb";
import { setupTestContainersVitest } from "pagopa-interop-commons-test/index.js";
import {
  genericInternalError,
  PlatformStatesAgreementEntry,
  TokenGenerationStatesClientPurposeEntry,
} from "pagopa-interop-models";
import { afterEach, inject } from "vitest";
import { unmarshall } from "@aws-sdk/util-dynamodb";

export const config = inject("tokenGenerationReadModelConfig");
export const { cleanup } = setupTestContainersVitest();

afterEach(cleanup);

// TODO: same function as catalog-platformstate-writer
export const writeTokenStateEntry = async (
  dynamoDBClient: DynamoDBClient,
  tokenStateEntry: TokenGenerationStatesClientPurposeEntry
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
      // descriptorVoucherLifespan: {
      //   N: tokenStateEntry.descriptorVoucherLifespan!.toString(),
      // },
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

// TODO: make a generic function to write without some data
export const writeTokenStateEntryWithoutAgreement = async (
  dynamoDBClient: DynamoDBClient,
  tokenStateEntry: TokenGenerationStatesClientPurposeEntry
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
      // descriptorVoucherLifespan: {
      //   N: tokenStateEntry.descriptorVoucherLifespan!.toString(),
      // },
      updatedAt: {
        S: tokenStateEntry.updatedAt,
      },
      consumerId: {
        S: tokenStateEntry.consumerId,
      },
      purposeVersionId: {
        S: tokenStateEntry.purposeVersionId!,
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

// TODO: same function as agreement-platformstate-writer
export const writeAgreementEntry = async (
  agreementEntry: PlatformStatesAgreementEntry,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  if (!config) {
    fail();
  }

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
  primaryKey: string,
  dynamoDBClient: DynamoDBClient
): Promise<PlatformStatesAgreementEntry | undefined> => {
  if (!config) {
    fail();
  }

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
        `Unable to parse agreement entry item: result ${JSON.stringify(
          agreementEntry
        )} - data ${JSON.stringify(data)} `
      );
    }
    return agreementEntry.data;
  }
};
