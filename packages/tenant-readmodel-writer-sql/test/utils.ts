import { inject, afterEach } from "vitest";
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { tenantReadModelServiceBuilderSQL } from "pagopa-interop-readmodel";
import { customReadModelServiceBuilder } from "../src/customReadModelService.js";

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

export const tenantReadModelServiceSQL =
  tenantReadModelServiceBuilderSQL(readModelDB);

export const customReadModelServiceSQL =
  customReadModelServiceBuilder(readModelDB);
