import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { inject, afterEach } from "vitest";
import { notificationConfigServiceBuilder } from "../src/services/notificationConfigService.js";

export const { cleanup, postgresDB } = await setupTestContainersVitest(
  undefined,
  inject("eventStoreConfig"),
  undefined,
  undefined,
  undefined,
  undefined,
  undefined
);

afterEach(cleanup);

export const notificationConfigService =
  notificationConfigServiceBuilder(postgresDB);
