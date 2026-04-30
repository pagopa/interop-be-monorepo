import { inject, afterEach } from "vitest";
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { tenantKindHistoryWriterServiceBuilder } from "../src/tenantKindHistoryWriterService.js";

export const { cleanup, tenantKindHistoryDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("tenantKindHistoryDBConfig")
);

afterEach(cleanup);

export const tenantKindHistoryWriterService =
  tenantKindHistoryWriterServiceBuilder(tenantKindHistoryDB);
