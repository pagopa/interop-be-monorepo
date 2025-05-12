import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  setupTestContainersVitest,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  Client,
  EService,
  Purpose,
  toReadModelAgreement,
  toReadModelClient,
  toReadModelEService,
  toReadModelPurpose,
} from "pagopa-interop-models";
import {
  agreementReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  clientReadModelServiceBuilder,
  purposeReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { afterEach, inject } from "vitest";
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

const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(readModelDB);
const purposeReadModelServiceSQL = purposeReadModelServiceBuilder(readModelDB);
const agreementReadModelServiceSQL =
  agreementReadModelServiceBuilder(readModelDB);
const clientReadModelServiceSQL = clientReadModelServiceBuilder(readModelDB);

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
  await writeInReadmodel(
    toReadModelEService(eservice),
    readModelRepository.eservices
  );

  await catalogReadModelServiceSQL.upsertEService(eservice, 0);
};

export const addOnePurpose = async (purpose: Purpose): Promise<void> => {
  await writeInReadmodel(
    toReadModelPurpose(purpose),
    readModelRepository.purposes
  );

  await purposeReadModelServiceSQL.upsertPurpose(purpose, 0);
};

export const addOneAgreement = async (agreement: Agreement): Promise<void> => {
  await writeInReadmodel(
    toReadModelAgreement(agreement),
    readModelRepository.agreements
  );

  await agreementReadModelServiceSQL.upsertAgreement(agreement, 0);
};

export const addOneClient = async (client: Client): Promise<void> => {
  await writeInReadmodel(
    toReadModelClient(client),
    readModelRepository.clients
  );

  await clientReadModelServiceSQL.upsertClient(client, 0);
};
