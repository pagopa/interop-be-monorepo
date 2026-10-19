import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { Purpose } from "pagopa-interop-models";
import { upsertPurpose } from "pagopa-interop-readmodel/testUtils";
import { afterEach, inject } from "vitest";

import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";

const config = inject("readModelSQLConfig");

export const { cleanup, readModelDB } = await setupTestContainersVitest(
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

export const readModelService = readModelServiceBuilderSQL(readModelDB);

export const addOnePurpose = async (purpose: Purpose): Promise<void> => {
  await upsertPurpose(readModelDB, purpose, 0);
};
