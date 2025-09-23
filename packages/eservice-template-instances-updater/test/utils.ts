import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { inject, afterEach } from "vitest";
import { EService, toReadModelEService } from "pagopa-interop-models";
import { upsertEService } from "pagopa-interop-readmodel/testUtils";
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

export const readModelService = readModelServiceBuilderSQL(readModelDB);

export const addOneEService = async (eservice: EService): Promise<void> => {
  await upsertEService(readModelDB, eservice, 1);
};
