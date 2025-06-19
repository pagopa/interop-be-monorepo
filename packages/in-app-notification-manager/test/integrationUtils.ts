import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { inject, afterEach, beforeEach, vi } from "vitest";
import { inAppNotificationServiceBuilder } from "../src/services/inAppNotificationService.js";
import { notification, Notification } from "../src/db/schema.js";

export const { cleanup, inAppNotificationDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("inAppNotificationDbConfig")
);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date());
});
afterEach(async () => {
  vi.useRealTimers();
  await cleanup();
});

export const inAppNotificationService =
  inAppNotificationServiceBuilder(inAppNotificationDB);

export const addOneNotification = async (n: Notification): Promise<void> => {
  await inAppNotificationDB.insert(notification).values(n);
};
