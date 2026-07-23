import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { notificationConfigReadModelServiceBuilder } from "pagopa-interop-readmodel";
import { inject, afterEach } from "vitest";

import { notificationConfigReadModelWriteServiceBuilder } from "../src/readModelWriteService.js";

export const { cleanup, readModelDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig")
);

afterEach(cleanup);

export const notificationConfigReadModelWriteService =
  notificationConfigReadModelWriteServiceBuilder(readModelDB);

export const notificationConfigReadModelService =
  notificationConfigReadModelServiceBuilder(readModelDB);
