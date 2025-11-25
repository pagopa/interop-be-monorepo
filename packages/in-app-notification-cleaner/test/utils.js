import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { inject, afterEach, beforeEach, vi } from "vitest";
import { generateId, } from "pagopa-interop-models";
import { notification } from "pagopa-interop-in-app-notification-db-models";
export const { cleanup, inAppNotificationDB } = await setupTestContainersVitest(undefined, undefined, undefined, undefined, undefined, undefined, undefined, inject("inAppNotificationDbConfig"));
beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
});
afterEach(async () => {
    vi.useRealTimers();
    await cleanup();
});
export const addNotifications = async (notifications) => {
    await inAppNotificationDB.insert(notification).values(notifications);
};
export const getMockNotification = ({ id = generateId(), userId = generateId(), tenantId = generateId(), body = "test notification", notificationType = "eserviceStateChangedToConsumer", entityId = generateId(), readAt = undefined, createdAt = new Date().toISOString(), }) => ({
    id,
    userId,
    tenantId,
    body,
    notificationType,
    entityId,
    readAt,
    createdAt,
});
