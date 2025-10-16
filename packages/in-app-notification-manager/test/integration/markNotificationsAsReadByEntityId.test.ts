import { eq } from "drizzle-orm";
import { notification as notificationTable } from "pagopa-interop-in-app-notification-db-models";
import { getMockAuthData, getMockContext } from "pagopa-interop-commons-test";
import { generateId, UserId, TenantId, IDS } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import {
  addNotifications,
  getMockNotification,
  inAppNotificationDB,
  inAppNotificationService,
} from "../integrationUtils.js";

describe("markNotificationsAsReadByEntityId", () => {
  const userId: UserId = generateId();
  const tenantId: TenantId = generateId();
  const entityId: IDS = generateId();

  it("should mark all notifications with the given entity ID as read", async () => {
    const notification1 = getMockNotification({
      userId,
      tenantId,
      entityId,
      body: "Notification 1",
    });
    const notification2 = getMockNotification({
      userId,
      tenantId,
      entityId,
      body: "Notification 2",
    });
    const notification3 = getMockNotification({
      userId,
      tenantId,
      entityId: generateId(),
      body: "Notification 3 - different entity",
    });

    await addNotifications([notification1, notification2, notification3]);

    await inAppNotificationService.markNotificationsAsReadByEntityId(
      entityId,
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
      .where(eq(notificationTable.entityId, entityId));

    expect(notifications).toHaveLength(2);
    expect(notifications[0].readAt).toBeDefined();
    expect(notifications[1].readAt).toBeDefined();

    const otherNotifications = await inAppNotificationDB
      .select()
      .from(notificationTable)
      .where(eq(notificationTable.id, notification3.id));

    expect(otherNotifications).toHaveLength(1);
    expect(otherNotifications[0].readAt).toBeNull();
  });

  it("should not mark notifications as read for different user", async () => {
    const otherUserId: UserId = generateId();
    const notification = getMockNotification({
      userId: otherUserId,
      tenantId,
      entityId,
      body: "Notification for other user",
    });

    await addNotifications([notification]);

    await inAppNotificationService.markNotificationsAsReadByEntityId(
      entityId,
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

  it("should not mark notifications as read for different tenant", async () => {
    const otherTenantId: TenantId = generateId();
    const notification = getMockNotification({
      userId,
      tenantId: otherTenantId,
      entityId,
      body: "Notification for other tenant",
    });

    await addNotifications([notification]);

    await inAppNotificationService.markNotificationsAsReadByEntityId(
      entityId,
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

  it("should do nothing if no notifications match the entity ID", async () => {
    const nonExistentEntityId: IDS = generateId();

    await inAppNotificationService.markNotificationsAsReadByEntityId(
      nonExistentEntityId,
      getMockContext({
        authData: {
          ...getMockAuthData(tenantId),
          userId,
        },
      })
    );

    const notifications = await inAppNotificationDB
      .select()
      .from(notificationTable);

    expect(notifications).toHaveLength(0);
  });
});
