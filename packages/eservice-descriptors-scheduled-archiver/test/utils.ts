import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { EService } from "pagopa-interop-models";
import { upsertEService } from "pagopa-interop-readmodel/testUtils";
import { afterEach, inject } from "vitest";

import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";

export const { cleanup, readModelDB } = await setupTestContainersVitest(
  inject("eventStoreConfig"),
  undefined,
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig")
);

afterEach(cleanup);

export const readModelService = readModelServiceBuilderSQL(readModelDB);

export const addOneEService = async (eservice: EService): Promise<void> => {
  await upsertEService(readModelDB, eservice, 0);
};

export const toUTCMidnight = (d: Date, offsetDays = 0): number =>
  Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + offsetDays);
