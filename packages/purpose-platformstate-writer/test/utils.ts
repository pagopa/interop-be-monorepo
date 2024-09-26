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
  PlatformStatesCatalogEntry,
  TokenGenerationStatesClientPurposeEntry,
  dateToBigInt,
  Purpose,
  PurposeStateV1,
  PurposeV1,
  PurposeVersion,
  PurposeVersionDocument,
  PurposeVersionDocumentV1,
  purposeVersionState,
  PurposeVersionState,
  PurposeVersionV1,
} from "pagopa-interop-models";
import { afterEach, inject } from "vitest";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { match } from "ts-pattern";

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
      // descriptorState: {
      //   S: tokenStateEntry.descriptorState!,
      // },
      // descriptorAudience: {
      //   S: tokenStateEntry.descriptorAudience!,
      // },
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
      // GSIPK_eserviceId_descriptorId: {
      //   S: tokenStateEntry.GSIPK_eserviceId_descriptorId!,
      // },
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
        S: catalogEntry.descriptorAudience,
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

// TODO: copied from purpose-readmodel-writer test utils
export const toPurposeVersionStateV1 = (
  input: PurposeVersionState
): PurposeStateV1 =>
  match(input)
    .with(purposeVersionState.draft, () => PurposeStateV1.DRAFT)
    .with(purposeVersionState.active, () => PurposeStateV1.ACTIVE)
    .with(purposeVersionState.suspended, () => PurposeStateV1.SUSPENDED)
    .with(purposeVersionState.archived, () => PurposeStateV1.ARCHIVED)
    .with(
      purposeVersionState.waitingForApproval,
      () => PurposeStateV1.WAITING_FOR_APPROVAL
    )
    .with(purposeVersionState.rejected, () => PurposeStateV1.REJECTED)
    .exhaustive();

export const toPurposeVersionDocumentV1 = (
  input: PurposeVersionDocument
): PurposeVersionDocumentV1 => ({
  ...input,
  createdAt: dateToBigInt(input.createdAt),
});

export const toPurposeVersionV1 = (
  input: PurposeVersion
): PurposeVersionV1 => ({
  ...input,
  state: toPurposeVersionStateV1(input.state),
  createdAt: dateToBigInt(input.createdAt),
  updatedAt: dateToBigInt(input.updatedAt),
  firstActivationAt: dateToBigInt(input.firstActivationAt),
  suspendedAt: dateToBigInt(input.suspendedAt),
  riskAnalysis: input.riskAnalysis
    ? toPurposeVersionDocumentV1(input.riskAnalysis)
    : undefined,
});

export const toPurposeV1 = (input: Purpose): PurposeV1 => ({
  ...input,
  versions: input.versions.map(toPurposeVersionV1),
  createdAt: dateToBigInt(input.createdAt),
  updatedAt: dateToBigInt(input.updatedAt),
});
