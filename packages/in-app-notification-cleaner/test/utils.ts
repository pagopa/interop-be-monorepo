import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { inject, afterEach, beforeEach, vi } from "vitest";
import {
  IDS,
  NotificationId,
  TenantId,
  UserId,
  generateId,
  NotificationType,
} from "pagopa-interop-models";
import { notification } from "pagopa-interop-in-app-notification-db-models";

export const { cleanup, inAppNotificationDB } = await setupTestContainersVitest(
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

export interface MockNotification {
  id: NotificationId;
  userId: UserId;
  tenantId: TenantId;
  body: string;
  notificationType: NotificationType;
  entityId: IDS;
  readAt?: string;
  createdAt: string;
}

export const addNotifications = async (
  notifications: MockNotification[]
): Promise<void> => {
  await inAppNotificationDB.insert(notification).values(notifications);
};

export const getMockNotification = ({
  id = generateId<NotificationId>(),
  userId = generateId<UserId>(),
  tenantId = generateId<TenantId>(),
  body = "test notification",
  notificationType = "eserviceStateChangedToConsumer" as NotificationType,
  entityId = generateId<IDS>(),
  readAt = undefined,
  createdAt = new Date().toISOString(),
}: {
  id?: NotificationId;
  userId?: UserId;
  tenantId?: TenantId;
  body?: string;
  notificationType?: NotificationType;
  entityId?: IDS;
  readAt?: string;
  createdAt?: string;
}): MockNotification => ({
  id,
  userId,
  tenantId,
  body,
  notificationType,
  entityId,
  readAt,
  createdAt,
});
