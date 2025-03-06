import { inject, afterEach } from "vitest";
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { catalogReadModelServiceBuilder } from "pagopa-interop-readmodel";
import { customReadModelServiceBuilder } from "../src/readModelService.js";

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

export const catalogReadModelService =
  catalogReadModelServiceBuilder(readModelDB);
export const readModelService = customReadModelServiceBuilder(
  readModelDB,
  catalogReadModelService
);
