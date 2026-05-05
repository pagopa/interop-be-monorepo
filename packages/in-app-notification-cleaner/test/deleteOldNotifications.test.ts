import { describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { notification } from "pagopa-interop-in-app-notification-db-models";
import { generateId, UserId, TenantId } from "pagopa-interop-models";
import { logger } from "pagopa-interop-commons";
import { deleteOldNotifications } from "../src/deleteOldNotifications.js";
import {
  addNotifications,
  getMockNotification,
  inAppNotificationDB,
} from "./utils.js";

describe("deleteOldNotifications", () => {
  const loggerInstance = logger({ serviceName: "test" });

  it("should delete notifications older than specified days", async () => {
    vi.setSystemTime(new Date("2024-01-15T10:00:00Z"));

    const userId = generateId<UserId>();
    const tenantId = generateId<TenantId>();

    // Create notifications with different ages
    const oldNotification1 = getMockNotification({
      userId,
      tenantId,
      createdAt: new Date("2023-10-01T10:00:00Z").toISOString(), // 106 days old
    });

    const oldNotification2 = getMockNotification({
      userId,
      tenantId,
      createdAt: new Date("2023-10-10T10:00:00Z").toISOString(), // 97 days old
    });

    const recentNotification = getMockNotification({
      userId,
      tenantId,
      createdAt: new Date("2023-12-01T10:00:00Z").toISOString(), // 45 days old
    });

    await addNotifications([
      oldNotification1,
      oldNotification2,
      recentNotification,
    ]);

    // Delete notifications older than 90 days
    const deletedCount = await deleteOldNotifications(
      inAppNotificationDB,
      90,
      loggerInstance
    );

    expect(deletedCount).toBe(2);

    // Verify old notifications are deleted
    const remainingNotifications = await inAppNotificationDB
      .select()
      .from(notification);

    expect(remainingNotifications).toHaveLength(1);
    expect(remainingNotifications[0].id).toBe(recentNotification.id);
  });

  it("should delete all notifications when all are older than specified days", async () => {
    vi.setSystemTime(new Date("2024-01-15T10:00:00Z"));

    const userId = generateId<UserId>();
    const tenantId = generateId<TenantId>();

    const oldNotification1 = getMockNotification({
      userId,
      tenantId,
      createdAt: new Date("2023-01-01T10:00:00Z").toISOString(),
    });

    const oldNotification2 = getMockNotification({
      userId,
      tenantId,
      createdAt: new Date("2023-02-01T10:00:00Z").toISOString(),
    });

    await addNotifications([oldNotification1, oldNotification2]);

    const deletedCount = await deleteOldNotifications(
      inAppNotificationDB,
      90,
      loggerInstance
    );

    expect(deletedCount).toBe(2);

    const remainingNotifications = await inAppNotificationDB
      .select()
      .from(notification);

    expect(remainingNotifications).toHaveLength(0);
  });

  it("should not delete any notifications when all are newer than specified days", async () => {
    vi.setSystemTime(new Date("2024-01-15T10:00:00Z"));

    const userId = generateId<UserId>();
    const tenantId = generateId<TenantId>();

    const recentNotification1 = getMockNotification({
      userId,
      tenantId,
      createdAt: new Date("2024-01-01T10:00:00Z").toISOString(), // 14 days old
    });

    const recentNotification2 = getMockNotification({
      userId,
      tenantId,
      createdAt: new Date("2024-01-10T10:00:00Z").toISOString(), // 5 days old
    });

    await addNotifications([recentNotification1, recentNotification2]);

    const deletedCount = await deleteOldNotifications(
      inAppNotificationDB,
      90,
      loggerInstance
    );

    expect(deletedCount).toBe(0);

    const remainingNotifications = await inAppNotificationDB
      .select()
      .from(notification);

    expect(remainingNotifications).toHaveLength(2);
  });

  it("should handle empty database", async () => {
    const deletedCount = await deleteOldNotifications(
      inAppNotificationDB,
      90,
      loggerInstance
    );

    expect(deletedCount).toBe(0);
  });

  it("should respect custom retention period", async () => {
    vi.setSystemTime(new Date("2024-01-15T10:00:00Z"));

    const userId = generateId<UserId>();
    const tenantId = generateId<TenantId>();

    const notification30DaysOld = getMockNotification({
      userId,
      tenantId,
      createdAt: new Date("2023-12-16T10:00:00Z").toISOString(), // 30 days old
    });

    const notification60DaysOld = getMockNotification({
      userId,
      tenantId,
      createdAt: new Date("2023-11-16T10:00:00Z").toISOString(), // 60 days old
    });

    const notification120DaysOld = getMockNotification({
      userId,
      tenantId,
      createdAt: new Date("2023-09-17T10:00:00Z").toISOString(), // 120 days old
    });

    await addNotifications([
      notification30DaysOld,
      notification60DaysOld,
      notification120DaysOld,
    ]);

    // Delete notifications older than 45 days
    const deletedCount = await deleteOldNotifications(
      inAppNotificationDB,
      45,
      loggerInstance
    );

    expect(deletedCount).toBe(2);

    const remainingNotifications = await inAppNotificationDB
      .select()
      .from(notification);

    expect(remainingNotifications).toHaveLength(1);
    expect(remainingNotifications[0].id).toBe(notification30DaysOld.id);
  });

  it("should delete notifications regardless of read status", async () => {
    vi.setSystemTime(new Date("2024-01-15T10:00:00Z"));

    const userId = generateId<UserId>();
    const tenantId = generateId<TenantId>();

    const oldReadNotification = getMockNotification({
      userId,
      tenantId,
      createdAt: new Date("2023-10-01T10:00:00Z").toISOString(),
      readAt: new Date("2023-10-02T10:00:00Z").toISOString(),
    });

    const oldUnreadNotification = getMockNotification({
      userId,
      tenantId,
      createdAt: new Date("2023-10-05T10:00:00Z").toISOString(),
      readAt: undefined,
    });

    await addNotifications([oldReadNotification, oldUnreadNotification]);

    const deletedCount = await deleteOldNotifications(
      inAppNotificationDB,
      90,
      loggerInstance
    );

    expect(deletedCount).toBe(2);

    const remainingNotifications = await inAppNotificationDB
      .select()
      .from(notification);

    expect(remainingNotifications).toHaveLength(0);
  });

  it("should delete notifications for different users and tenants", async () => {
    vi.setSystemTime(new Date("2024-01-15T10:00:00Z"));

    const user1 = generateId<UserId>();
    const user2 = generateId<UserId>();
    const tenant1 = generateId<TenantId>();
    const tenant2 = generateId<TenantId>();

    const oldNotificationUser1 = getMockNotification({
      userId: user1,
      tenantId: tenant1,
      createdAt: new Date("2023-10-01T10:00:00Z").toISOString(),
    });

    const oldNotificationUser2 = getMockNotification({
      userId: user2,
      tenantId: tenant2,
      createdAt: new Date("2023-10-05T10:00:00Z").toISOString(),
    });

    const recentNotificationUser1 = getMockNotification({
      userId: user1,
      tenantId: tenant1,
      createdAt: new Date("2023-12-01T10:00:00Z").toISOString(),
    });

    await addNotifications([
      oldNotificationUser1,
      oldNotificationUser2,
      recentNotificationUser1,
    ]);

    const deletedCount = await deleteOldNotifications(
      inAppNotificationDB,
      90,
      loggerInstance
    );

    expect(deletedCount).toBe(2);

    const remainingNotifications = await inAppNotificationDB
      .select()
      .from(notification)
      .where(eq(notification.userId, user1));

    expect(remainingNotifications).toHaveLength(1);
    expect(remainingNotifications[0].id).toBe(recentNotificationUser1.id);
  });

  it("should handle edge case at exact cutoff date", async () => {
    vi.setSystemTime(new Date("2024-01-15T10:00:00Z"));

    const userId = generateId<UserId>();
    const tenantId = generateId<TenantId>();

    // Notification created exactly 90 days ago
    const notificationAtCutoff = getMockNotification({
      userId,
      tenantId,
      createdAt: new Date("2023-10-17T10:00:00Z").toISOString(), // Exactly 90 days
    });

    // Notification created 91 days ago
    const notificationBeyondCutoff = getMockNotification({
      userId,
      tenantId,
      createdAt: new Date("2023-10-16T10:00:00Z").toISOString(), // 91 days
    });

    // Notification created 89 days ago
    const notificationBeforeCutoff = getMockNotification({
      userId,
      tenantId,
      createdAt: new Date("2023-10-18T10:00:00Z").toISOString(), // 89 days
    });

    await addNotifications([
      notificationAtCutoff,
      notificationBeyondCutoff,
      notificationBeforeCutoff,
    ]);

    const deletedCount = await deleteOldNotifications(
      inAppNotificationDB,
      90,
      loggerInstance
    );

    // Should delete notifications older than 90 days (not including exactly 90 days)
    expect(deletedCount).toBe(1);

    const remainingNotifications = await inAppNotificationDB
      .select()
      .from(notification);

    expect(remainingNotifications).toHaveLength(2);
  });
});
