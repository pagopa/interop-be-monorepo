import { describe, it, expect } from "vitest";
import { getMockContext } from "pagopa-interop-commons-test";
import { getMockAuthData } from "pagopa-interop-commons-test";
import { generateId, UserId, TenantId } from "pagopa-interop-models";
import {
  addNotifications,
  inAppNotificationService,
  getMockNotification,
} from "../integrationUtils.js";

describe("hasUnreadNotification", () => {
  const userId: UserId = generateId();
  const tenantId: TenantId = generateId();
  const entityId = generateId();

  const notificationsList = Array.from({ length: 2 }, (_, i) =>
    getMockNotification({
      userId,
      tenantId,
      body: `Notification ${i}`,
      readAt: undefined,
      entityId,
    })
  );
  it("should return the list of entities that have unread notifications", async () => {
    await addNotifications(notificationsList);
    const entitiesWithUnread =
      await inAppNotificationService.hasUnreadNotification(
        [entityId],
        getMockContext({
          authData: {
            ...getMockAuthData(tenantId),
            userId,
          },
        })
      );

    expect(entitiesWithUnread.length).toBe(1);
    expect(entitiesWithUnread).toEqual([entityId]);
  });

  it("should return an empty list if there are no entities with unread notifications", async () => {
    const notificationsList = Array.from({ length: 2 }, (_, i) =>
      getMockNotification({
        userId,
        tenantId,
        body: `Notification ${i}`,
        readAt: new Date(),
        entityId,
      })
    );
    await addNotifications(notificationsList);

    const entitiesWithUnread =
      await inAppNotificationService.hasUnreadNotification(
        [entityId],
        getMockContext({
          authData: {
            ...getMockAuthData(tenantId),
            userId,
          },
        })
      );

    expect(entitiesWithUnread.length).toBe(0);
  });
});
