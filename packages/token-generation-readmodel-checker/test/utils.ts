import {
  DynamoDBClient,
  PutItemInput,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import {
  setupTestContainersVitest,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  Client,
  EService,
  PlatformStatesClientEntry,
  Purpose,
  toReadModelAgreement,
  toReadModelClient,
  toReadModelEService,
  toReadModelPurpose,
} from "pagopa-interop-models";
import { afterEach, inject } from "vitest";

export const config = inject("tokenGenerationReadModelConfig");

export const { cleanup, readModelRepository } = await setupTestContainersVitest(
  inject("readModelConfig")
);

afterEach(cleanup);

if (!config) {
  throw new Error("config is not defined");
}

export const dynamoDBClient = new DynamoDBClient({
  endpoint: `http://localhost:${config.tokenGenerationReadModelDbPort}`,
});

export const addOneEService = async (eservice: EService): Promise<void> => {
  await writeInReadmodel(
    toReadModelEService(eservice),
    readModelRepository.eservices
  );
};

export const addOnePurpose = async (purpose: Purpose): Promise<void> => {
  await writeInReadmodel(
    toReadModelPurpose(purpose),
    readModelRepository.purposes
  );
};

export const addOneAgreement = async (agreement: Agreement): Promise<void> => {
  await writeInReadmodel(
    toReadModelAgreement(agreement),
    readModelRepository.agreements
  );
};

export const addOneClient = async (client: Client): Promise<void> => {
  await writeInReadmodel(
    toReadModelClient(client),
    readModelRepository.clients
  );
};

export const writePlatformStatesClientEntry = async (
  clientEntry: PlatformStatesClientEntry,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
  const input: PutItemInput = {
    ConditionExpression: "attribute_not_exists(PK)",
    Item: {
      PK: {
        S: clientEntry.PK,
      },
      state: {
        S: clientEntry.state,
      },
      clientPurposesIds: {
        L: clientEntry.clientPurposesIds.map((purposeId) => ({
          S: purposeId,
        })),
      },
      clientKind: {
        S: clientEntry.clientKind,
      },
      clientConsumerId: {
        S: clientEntry.clientConsumerId,
      },
      version: {
        N: clientEntry.version.toString(),
      },
      updatedAt: {
        S: clientEntry.updatedAt,
      },
    },
    TableName: "platform-states",
  };
  const command = new PutItemCommand(input);
  await dynamoDBClient.send(command);
};
