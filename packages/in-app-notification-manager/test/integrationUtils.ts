import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { inject, afterEach, beforeEach, vi } from "vitest";
import {
  Notification,
  NotificationId,
  TenantId,
  UserId,
  generateId,
} from "pagopa-interop-models";
import { notification } from "pagopa-interop-in-app-notification-db-models";
import { inAppNotificationServiceBuilder } from "../src/services/inAppNotificationService.js";

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

export const addNotifications = async (n: Notification[]): Promise<void> => {
  await inAppNotificationDB.insert(notification).values(
    n.map((n) => ({
      id: n.id,
      userId: n.userId,
      tenantId: n.tenantId,
      body: n.body,
      deepLink: n.deepLink,
      readAt: n.readAt?.toISOString(),
      createdAt: n.createdAt.toISOString(),
    }))
  );
};

export const getMockNotification = ({
  id = generateId<NotificationId>(),
  userId = generateId<UserId>(),
  tenantId = generateId<TenantId>(),
  body = "test",
  deepLink = "test",
  readAt = undefined,
  createdAt = new Date(),
}: {
  id?: NotificationId;
  userId?: UserId;
  tenantId?: TenantId;
  body?: string;
  deepLink?: string;
  readAt?: Date;
  createdAt?: Date;
}): Notification => ({
  id,
  userId,
  tenantId,
  body,
  deepLink,
  readAt,
  createdAt,
});
