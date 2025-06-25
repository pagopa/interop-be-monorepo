import { describe, it, expect } from "vitest";
import { generateId, UserId, TenantId } from "pagopa-interop-models";
import { getMockAuthData, getMockContext } from "pagopa-interop-commons-test";
import { eq } from "drizzle-orm";
import {
  addNotifications,
  getMockNotification,
  inAppNotificationDB,
  inAppNotificationService,
} from "../integrationUtils.js";
import { notification as notificationTable } from "../../src/db/schema.js";
import { notificationNotFound } from "../../src/model/errors.js";

describe("markNotificationAsRead", () => {
  const userId: UserId = generateId();
  const tenantId: TenantId = generateId();

  it("should mark a notification as read", async () => {
    const notification = getMockNotification({
      userId,
      tenantId,
      body: "Notification",
    });
    await addNotifications([notification]);
    await inAppNotificationService.markNotificationAsRead(
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
    expect(notifications[0].readAt).toBeDefined();
  });

  it("should throw an error if the notification does not exist", async () => {
    const notificationId = generateId();
    await expect(
      inAppNotificationService.markNotificationAsRead(
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
