import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { Agreement, Client, EService, Purpose } from "pagopa-interop-models";
import { afterEach, inject } from "vitest";
import {
  upsertAgreement,
  upsertClient,
  upsertEService,
  upsertPurpose,
} from "pagopa-interop-readmodel/testUtils";
import { readModelServiceBuilder } from "../src/services/readModelService.js";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";
import { config as checkerConfig } from "../src/configs/config.js";

export const config = inject("tokenGenerationReadModelConfig");

export const { cleanup, readModelRepository, readModelDB } =
  await setupTestContainersVitest(
    inject("readModelConfig"),
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

const oldReadModelService = readModelServiceBuilder(readModelRepository);
const readModelServiceSQL = readModelServiceBuilderSQL(readModelDB);
export const readModelService =
  checkerConfig.featureFlagSQL &&
  checkerConfig.readModelSQLDbHost &&
  checkerConfig.readModelSQLDbPort
    ? readModelServiceSQL
    : oldReadModelService;

export const dynamoDBClient = new DynamoDBClient({
  endpoint: `http://localhost:${config.tokenGenerationReadModelDbPort}`,
});

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
