import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { EService } from "pagopa-interop-models";
import { upsertEService } from "pagopa-interop-readmodel/testUtils";
import { inject, afterEach } from "vitest";

import { readModelServiceBuilderSQL } from "../src/readModelServiceSQL.js";

export const { cleanup, readModelDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig")
);

afterEach(cleanup);

export const readModelService = readModelServiceBuilderSQL(readModelDB);

export const addOneEService = async (eservice: EService): Promise<void> => {
  await upsertEService(readModelDB, eservice, 1);
};
