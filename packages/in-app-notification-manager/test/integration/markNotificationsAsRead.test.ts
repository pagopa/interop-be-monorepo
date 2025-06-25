import { describe, it, expect } from "vitest";
import { generateId, UserId, TenantId } from "pagopa-interop-models";
import { getMockAuthData, getMockContext } from "pagopa-interop-commons-test";
import { isNull } from "drizzle-orm";
import {
  addNotifications,
  getMockNotification,
  inAppNotificationDB,
  inAppNotificationService,
} from "../integrationUtils.js";
import { notification } from "../../src/db/schema.js";

describe("markNotificationsAsRead", () => {
  const userId: UserId = generateId();
  const tenantId: TenantId = generateId();

  it("should mark a list of notifications as read", async () => {
    const notificationsList = Array.from({ length: 10 }, (_, i) =>
      getMockNotification({
        userId,
        tenantId,
        body: `Notification ${i}`,
      })
    );
    await addNotifications(notificationsList);
    await inAppNotificationService.markNotificationsAsRead(
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
      .where(isNull(notification.readAt));
    expect(notifications).toHaveLength(0);
  });
});
