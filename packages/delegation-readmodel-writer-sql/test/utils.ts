import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { inject, afterEach } from "vitest";
import { delegationReadModelServiceBuilder } from "pagopa-interop-readmodel";
import { readModelServiceBuilder } from "../src/readModelService.js";

export const { cleanup, readModelDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig")
);

afterEach(cleanup);

export const readModelService = readModelServiceBuilder(
  delegationReadModelServiceBuilder(readModelDB)
);
