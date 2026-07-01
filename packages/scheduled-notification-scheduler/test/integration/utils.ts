import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { afterEach, inject } from "vitest";
import { schedulerServiceBuilder } from "../../src/services/schedulerService.js";

export const { scheduledNotificationDB, cleanup } =
  await setupTestContainersVitest(
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    inject("scheduledNotificationDbConfig")
  );

afterEach(cleanup);

export const schedulerService = schedulerServiceBuilder(
  scheduledNotificationDB
);
