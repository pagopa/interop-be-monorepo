import { describe, it, expect } from "vitest";
import {
  generateId,
  UserId,
  TenantId,
  NotificationId,
} from "pagopa-interop-models";
import { eq } from "drizzle-orm";
import { getMockAuthData, getMockContext } from "pagopa-interop-commons-test";
import {
  addNotifications,
  getMockNotification,
  inAppNotificationDB,
  inAppNotificationService,
} from "../integrationUtils.js";
import { notification } from "../../src/db/schema.js";
import { notificationNotFound } from "../../src/model/errors.js";

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
    const notifications = await inAppNotificationDB
      .select()
      .from(notification)
      .where(eq(notification.id, notificationIdToDelete));
    expect(notifications).toHaveLength(0);
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
