import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { notification } from "pagopa-interop-in-app-notification-db-models";
import {
  generateId,
  UserId,
  TenantId,
  NotificationId,
} from "pagopa-interop-models";
import { getMockAuthData, getMockContext } from "pagopa-interop-commons-test";
import { notificationNotFound } from "../../src/model/errors.js";
import {
  addNotifications,
  getMockNotification,
  inAppNotificationDB,
  inAppNotificationService,
} from "../integrationUtils.js";

describe("deleteNotification", () => {
  const userId: UserId = generateId();
  const tenantId: TenantId = generateId();

  it("should delete a notification", async () => {
    const notificationIdToDelete: NotificationId = generateId();
    await addNotifications([
      getMockNotification({
        userId,
        tenantId,
      }),
      getMockNotification({
        id: notificationIdToDelete,
        userId,
        tenantId,
      }),
    ]);
    await inAppNotificationService.deleteNotification(
      notificationIdToDelete,
      getMockContext({
        authData: {
          ...getMockAuthData(tenantId),
          userId,
        },
      })
    );
    // Verify the specified notification is deleted
    const deletedNotification = await inAppNotificationDB
      .select()
      .from(notification)
      .where(eq(notification.id, notificationIdToDelete));
    expect(deletedNotification).toHaveLength(0);

    // Verify other notifications still exist
    const remainingNotifications = await inAppNotificationDB
      .select()
      .from(notification);
    expect(remainingNotifications).toHaveLength(1);
    expect(remainingNotifications[0].id).not.toBe(notificationIdToDelete);
  });

  it("should throw an error if the notification is not found", async () => {
    const notificationIdToDelete: NotificationId = generateId();
    await expect(
      inAppNotificationService.deleteNotification(
        notificationIdToDelete,
        getMockContext({
          authData: {
            ...getMockAuthData(tenantId),
            userId,
          },
        })
      )
    ).rejects.toThrowError(notificationNotFound(notificationIdToDelete));
  });
});
