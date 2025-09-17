import { eq } from "drizzle-orm";
import { notification as notificationTable } from "pagopa-interop-in-app-notification-db-models";
import { getMockAuthData, getMockContext } from "pagopa-interop-commons-test";
import {
  generateId,
  UserId,
  TenantId,
  NotificationId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { notificationNotFound } from "../../src/model/errors.js";
import {
  addNotifications,
  getMockNotification,
  inAppNotificationDB,
  inAppNotificationService,
} from "../integrationUtils.js";

describe("markNotificationAsUnread", () => {
  const userId: UserId = generateId();
  const tenantId: TenantId = generateId();

  it("should mark a notification as unread", async () => {
    const notification = getMockNotification({
      userId,
      tenantId,
      body: "Notification",
      readAt: new Date(), // Start with read notification
    });
    await addNotifications([notification]);
    await inAppNotificationService.markNotificationAsUnread(
      notification.id,
      getMockContext({
        authData: {
          ...getMockAuthData(tenantId),
          userId,
        },
      })
    );

    const notifications = await inAppNotificationDB
      .select()
      .from(notificationTable)
      .where(eq(notificationTable.id, notification.id));
    expect(notifications).toHaveLength(1);
    expect(notifications[0].readAt).toBeNull();
  });

  it("should throw an error if the notification does not exist", async () => {
    const notificationId = generateId<NotificationId>();
    await expect(
      inAppNotificationService.markNotificationAsUnread(
        notificationId,
        getMockContext({
          authData: {
            ...getMockAuthData(tenantId),
            userId,
          },
        })
      )
    ).rejects.toThrowError(notificationNotFound(notificationId));
  });
});
