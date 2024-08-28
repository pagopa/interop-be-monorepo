import {
  descriptorState,
  DescriptorState,
  genericInternalError,
  ItemState,
  PlatformStatesCatalogEntry,
} from "pagopa-interop-models";
import {
  DeleteItemCommand,
  DeleteItemInput,
  DynamoDBClient,
  GetItemCommand,
  GetItemCommandOutput,
  GetItemInput,
  PutItemCommand,
  PutItemInput,
  ScanCommand,
  ScanCommandOutput,
  ScanInput,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { config } from "./config/config.js";

export const writeCatalogEntry = async (
  catalogEntry: PlatformStatesCatalogEntry,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const input: PutItemInput = {
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

export const readCatalogEntry = async (
  primaryKey: string,
  dynamoDBClient: DynamoDBClient
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

export const deleteCatalogEntry = async (
  primaryKey: string,
  dynamoDBClient: DynamoDBClient
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

export const readAllItems = async (
  dynamoDBClient: DynamoDBClient
): Promise<ScanCommandOutput> => {
  const readInput: ScanInput = {
    TableName: config.tokenGenerationReadModelTableNamePlatform,
  };
  const commandQuery = new ScanCommand(readInput);
  const read: ScanCommandOutput = await dynamoDBClient.send(commandQuery);
  return read;
};

export const descriptorStateToClientState = (
  state: DescriptorState
): ItemState =>
  state === descriptorState.published || state === descriptorState.deprecated
    ? ItemState.Enum.ACTIVE
    : ItemState.Enum.INACTIVE;
