import { generateId, UserId, TenantId } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { getMockAuthData, getMockContext } from "pagopa-interop-commons-test";
import { isNotNull } from "drizzle-orm";
import { notification } from "pagopa-interop-in-app-notification-db-models";
import {
  addNotifications,
  getMockNotification,
  inAppNotificationDB,
  inAppNotificationService,
} from "../integrationUtils.js";

describe("markNotificationsAsUnread", () => {
  const userId: UserId = generateId();
  const tenantId: TenantId = generateId();

  it("should mark a list of notifications as unread", async () => {
    const notificationsList = Array.from({ length: 10 }, (_, i) =>
      getMockNotification({
        userId,
        tenantId,
        body: `Notification ${i}`,
        readAt: new Date(), // Start with read notifications
      })
    );
    await addNotifications(notificationsList);
    await inAppNotificationService.markNotificationsAsUnread(
      notificationsList.map((notification) => notification.id),
      getMockContext({
        authData: {
          ...getMockAuthData(tenantId),
          userId,
        },
      })
    );

    const notifications = await inAppNotificationDB
      .select()
      .from(notification)
      .where(isNotNull(notification.readAt));
    expect(notifications).toHaveLength(0);
  });
});
