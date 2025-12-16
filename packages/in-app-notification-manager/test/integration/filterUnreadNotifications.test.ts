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
  const newUnreadNotification = (): ReturnType<typeof getMockNotification> =>
    getMockNotification({
      userId,
      tenantId,
      body: "New unread notification",
      readAt: undefined,
      entityId,
    });

  const newReadNotification = (): ReturnType<typeof getMockNotification> =>
    getMockNotification({
      userId,
      tenantId,
      body: "New read notification",
      readAt: new Date(),
      entityId,
    });
  it("should return the list of entities that have unread notifications", async () => {
    const differentEntityNotification = getMockNotification({
      userId,
      tenantId,
      body: "New read notification",
      readAt: new Date(),
      entityId: generateId(),
    });
    await addNotifications([
      newUnreadNotification(),
      newReadNotification(),
      newReadNotification(),
      differentEntityNotification,
    ]);
    const entitiesWithUnread =
      await inAppNotificationService.hasUnreadNotifications(
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
    const notificationsList = [newReadNotification(), newReadNotification()];
    await addNotifications(notificationsList);

    const entitiesWithUnread =
      await inAppNotificationService.hasUnreadNotifications(
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
