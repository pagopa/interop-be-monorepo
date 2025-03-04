import { inject, afterEach } from "vitest";
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { attributeReadModelServiceBuilderSQL } from "pagopa-interop-readmodel";

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

export const attributeReadModelService =
  attributeReadModelServiceBuilderSQL(readModelDB);
