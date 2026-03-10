import { generateId, UserId, TenantId } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { getMockAuthData, getMockContext } from "pagopa-interop-commons-test";
import { isNotNull, isNull } from "drizzle-orm";
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

  it("should mark some notifications as unread while others remain read", async () => {
    const readNotifications = Array.from({ length: 5 }, (_, i) =>
      getMockNotification({
        userId,
        tenantId,
        body: `Read Notification ${i}`,
        readAt: new Date(),
      })
    );

    const alreadyUnreadNotifications = Array.from({ length: 3 }, (_, i) =>
      getMockNotification({
        userId,
        tenantId,
        body: `Unread Notification ${i}`,
        readAt: undefined,
      })
    );

    await addNotifications([
      ...readNotifications,
      ...alreadyUnreadNotifications,
    ]);

    const idsToMarkUnread = readNotifications.slice(0, 3).map((n) => n.id);
    await inAppNotificationService.markNotificationsAsUnread(
      idsToMarkUnread,
      getMockContext({
        authData: {
          ...getMockAuthData(tenantId),
          userId,
        },
      })
    );

    const unreadNotifications = await inAppNotificationDB
      .select()
      .from(notification)
      .where(isNull(notification.readAt));
    expect(unreadNotifications).toHaveLength(6);

    const readNotificationsAfter = await inAppNotificationDB
      .select()
      .from(notification)
      .where(isNotNull(notification.readAt));
    expect(readNotificationsAfter).toHaveLength(2);
  });
});
