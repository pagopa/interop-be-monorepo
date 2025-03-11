import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { agreementReadModelServiceBuilder } from "pagopa-interop-readmodel";
import { afterEach, inject } from "vitest";
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

export const agreementReadModelService =
  agreementReadModelServiceBuilder(readModelDB);
export const readModelService = readModelServiceBuilder(
  readModelDB,
  agreementReadModelService
);
