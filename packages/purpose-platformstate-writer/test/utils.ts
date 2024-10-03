import { fail } from "assert";
import {
  DynamoDBClient,
  GetItemCommand,
  GetItemCommandOutput,
  GetItemInput,
  PutItemCommand,
  PutItemInput,
} from "@aws-sdk/client-dynamodb";
import {
  genericInternalError,
  PlatformStatesAgreementEntry,
  PlatformStatesCatalogEntry,
} from "pagopa-interop-models";
import { inject } from "vitest";
import { unmarshall } from "@aws-sdk/util-dynamodb";

export const config = inject("tokenGenerationReadModelConfig");

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

// TODO: copied from catalog-platformstate-writer
export const writeCatalogEntry = async (
  dynamoDBClient: DynamoDBClient,
  catalogEntry: PlatformStatesCatalogEntry
): Promise<void> => {
  if (!config) {
    fail();
  }

  const input: PutItemInput = {
    ConditionExpression: "attribute_not_exists(PK)",
    Item: {
      PK: {
        S: catalogEntry.PK,
      },
      state: {
        S: catalogEntry.state,
      },
      descriptorAudience: {
        L: catalogEntry.descriptorAudience.map((item) => ({
          S: item,
        })),
      },
      descriptorVoucherLifespan: {
        N: catalogEntry.descriptorVoucherLifespan.toString(),
      },
      version: {
        N: catalogEntry.version.toString(),
      },
      updatedAt: {
        S: catalogEntry.updatedAt,
      },
    },
    TableName: config.tokenGenerationReadModelTableNamePlatform,
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
};
