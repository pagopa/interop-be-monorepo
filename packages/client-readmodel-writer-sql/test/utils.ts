import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { clientReadModelServiceBuilder } from "pagopa-interop-readmodel";
import { inject, afterEach } from "vitest";
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

export const clientReadModelService =
  clientReadModelServiceBuilder(readModelDB);
export const readModelService = readModelServiceBuilder(
  readModelDB,
  clientReadModelService
);
