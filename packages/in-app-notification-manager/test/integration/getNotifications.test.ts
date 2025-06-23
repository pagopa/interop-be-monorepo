import { describe, it, expect } from "vitest";

import { getMockContext } from "pagopa-interop-commons-test";
import { getMockAuthData } from "pagopa-interop-commons-test";
import { generateId, UserId, TenantId } from "pagopa-interop-models";
import {
  addNotifications,
  inAppNotificationService,
  getMockNotification,
} from "../integrationUtils.js";

describe("getNotifications", () => {
  const userId: UserId = generateId();
  const tenantId: TenantId = generateId();

  const notificationsList = Array.from({ length: 10 }, (_, i) =>
    getMockNotification({
      userId,
      tenantId,
      body: `Notification ${i}`,
    })
  );

  it("should return the list of notifications", async () => {
    await addNotifications(notificationsList);
    const notifications = await inAppNotificationService.getNotifications(
      undefined,
      5,
      0,
      getMockContext({
        authData: {
          ...getMockAuthData(tenantId),
          userId,
        },
      })
    );
    expect(notifications).toBeDefined();
    expect(notifications.results).toEqual(notificationsList.slice(0, 5));
    expect(notifications.totalCount).toBe(10);
  });

  it("should return the list of notifications with query", async () => {
    await addNotifications(notificationsList);
    const notifications = await inAppNotificationService.getNotifications(
      "Notification 1",
      5,
      0,
      getMockContext({
        authData: {
          ...getMockAuthData(tenantId),
          userId,
        },
      })
    );
    expect(notifications).toBeDefined();
    expect(notifications.results).toEqual(notificationsList.slice(1, 2));
    expect(notifications.totalCount).toBe(1);
  });

  it("should return an empty list when no notifications match the filter", async () => {
    await addNotifications(notificationsList);
    const nonExistentFilter = "ThisFilterWillNotMatchAnyNotification";
    const result = await inAppNotificationService.getNotifications(
      nonExistentFilter,
      5,
      0,
      getMockContext({
        authData: {
          ...getMockAuthData(tenantId),
          userId,
        },
      })
    );
    expect(result).toBeDefined();
    expect(result.results).toEqual([]);
    expect(result.totalCount).toBe(0);
  });
});
