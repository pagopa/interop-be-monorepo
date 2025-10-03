import { describe, it, expect } from "vitest";

import { getMockContext } from "pagopa-interop-commons-test";
import { getMockAuthData } from "pagopa-interop-commons-test";
import {
  generateId,
  UserId,
  TenantId,
  fromNotificationSQL,
} from "pagopa-interop-models";
import { eq, desc } from "drizzle-orm";
import { notification } from "pagopa-interop-in-app-notification-db-models";
import {
  addNotifications,
  inAppNotificationService,
  getMockNotification,
  inAppNotificationDB,
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
      [],
      5,
      0,
      getMockContext({
        authData: {
          ...getMockAuthData(tenantId),
          userId,
        },
      })
    );

    const expectedNotifications = await inAppNotificationDB
      .select()
      .from(notification)
      .where(eq(notification.userId, userId))
      .orderBy(desc(notification.createdAt))
      .limit(5)
      .offset(0);

    expect(notifications.results).toEqual(
      expectedNotifications.map(fromNotificationSQL)
    );
    expect(notifications.totalCount).toBe(10);
  });

  it("should return the list of notifications with query", async () => {
    await addNotifications(notificationsList);
    const notifications = await inAppNotificationService.getNotifications(
      "Notification 1",
      [],
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
      [],
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

  it("should return paginated results with different limit values", async () => {
    await addNotifications(notificationsList);

    // Test with limit = 1
    const result1 = await inAppNotificationService.getNotifications(
      undefined,
      [],
      1,
      0,
      getMockContext({
        authData: {
          ...getMockAuthData(tenantId),
          userId,
        },
      })
    );
    expect(result1.results).toHaveLength(1);
    expect(result1.totalCount).toBe(10);

    // Test with limit = 3
    const result2 = await inAppNotificationService.getNotifications(
      undefined,
      [],
      3,
      0,
      getMockContext({
        authData: {
          ...getMockAuthData(tenantId),
          userId,
        },
      })
    );
    expect(result2.results).toHaveLength(3);
    expect(result2.totalCount).toBe(10);
  });

  it("should handle different offset values correctly", async () => {
    await addNotifications(notificationsList);

    // Get first page
    const firstPage = await inAppNotificationService.getNotifications(
      undefined,
      [],
      3,
      0,
      getMockContext({
        authData: {
          ...getMockAuthData(tenantId),
          userId,
        },
      })
    );

    // Get second page
    const secondPage = await inAppNotificationService.getNotifications(
      undefined,
      [],
      3,
      3,
      getMockContext({
        authData: {
          ...getMockAuthData(tenantId),
          userId,
        },
      })
    );

    expect(firstPage.results).not.toEqual(secondPage.results);
    expect(firstPage.results[0].id).not.toBe(secondPage.results[0].id);
    expect(firstPage.totalCount).toBe(10);
    expect(secondPage.totalCount).toBe(10);
  });

  it("should handle limit larger than total count", async () => {
    await addNotifications(notificationsList);

    const result = await inAppNotificationService.getNotifications(
      undefined,
      [],
      100, // Limit larger than total count
      0,
      getMockContext({
        authData: {
          ...getMockAuthData(tenantId),
          userId,
        },
      })
    );

    expect(result.results).toHaveLength(10);
    expect(result.totalCount).toBe(10);
  });
});
