import {
  setupTestContainersVitest,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import { inject, afterEach } from "vitest";
import { EService, toReadModelEService } from "pagopa-interop-models";
import { catalogReadModelServiceBuilder } from "pagopa-interop-readmodel";
import { readModelServiceBuilder } from "../src/readModelService.js";
import { readModelServiceBuilderSQL } from "../src/readModelServiceSQL.js";
import { config } from "../src/config/config.js";

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

export const { agreements, clients, eservices, purposes } = readModelRepository;

const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(readModelDB);

const oldReadModelService = readModelServiceBuilder(readModelRepository);
const readModelServiceSQL = readModelServiceBuilderSQL(readModelDB);
export const readModelService =
  config.featureFlagSQL &&
  config.readModelSQLDbHost &&
  config.readModelSQLDbPort
    ? readModelServiceSQL
    : oldReadModelService;

export const addOneEService = async (eservice: EService): Promise<void> => {
  await writeInReadmodel(toReadModelEService(eservice), eservices);
  await catalogReadModelServiceSQL.upsertEService(eservice, 1);
};
