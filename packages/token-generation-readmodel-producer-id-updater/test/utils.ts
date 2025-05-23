import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  setupTestContainersVitest,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import { Agreement, toReadModelAgreement } from "pagopa-interop-models";
import { afterEach, inject } from "vitest";
import { readModelServiceBuilder } from "../src/services/readModelService.js";

export const { cleanup, readModelRepository } = await setupTestContainersVitest(
  inject("readModelConfig")
);

afterEach(cleanup);

export const config = inject("tokenGenerationReadModelConfig");
if (!config) {
  throw new Error("Config is not defined");
}
export const dynamoDBClient = new DynamoDBClient({
  endpoint: `http://localhost:${config.tokenGenerationReadModelDbPort}`,
});

export const readModelService = readModelServiceBuilder(readModelRepository);

export const addOneAgreement = async (agreement: Agreement): Promise<void> => {
  await writeInReadmodel(
    toReadModelAgreement(agreement),
    readModelRepository.agreements
  );
};
