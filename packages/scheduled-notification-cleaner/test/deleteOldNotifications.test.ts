import { describe, expect, it, vi } from "vitest";
import { scheduledNotification } from "pagopa-interop-scheduled-notification-db-models";
import { logger } from "pagopa-interop-commons";
import { deleteOldNotifications } from "../src/deleteOldNotifications.js";
import {
  addScheduledNotifications,
  getMockNotification,
  scheduledNotificationDB,
} from "./utils.js";

describe("deleteOldNotifications", () => {
  const loggerInstance = logger({ serviceName: "test" });

  it("should delete notifications older than specified days", async () => {
    vi.setSystemTime(new Date("2024-01-15T10:00:00Z"));

    // Create notifications with different ages
    const oldNotification1 = getMockNotification({
      sentAt: new Date("2023-10-01T10:00:00Z"), // 106 days old
    });

    const oldNotification2 = getMockNotification({
      sentAt: new Date("2023-10-10T10:00:00Z"), // 97 days old
    });

    const recentNotification = getMockNotification({
      sentAt: new Date("2023-12-01T10:00:00Z"), // 45 days old
    });

    await addScheduledNotifications([
      oldNotification1,
      oldNotification2,
      recentNotification,
    ]);

    // Delete notifications older than 90 days
    const deletedCount = await deleteOldNotifications(
      scheduledNotificationDB,
      90,
      loggerInstance
    );

    expect(deletedCount).toBe(2);

    // Verify old notifications are deleted
    const remainingNotifications = await scheduledNotificationDB
      .select()
      .from(scheduledNotification);

    expect(remainingNotifications).toHaveLength(1);
    expect(remainingNotifications[0].id).toBe(recentNotification.id);
  });

  it("should delete all notifications when all are older than specified days", async () => {
    vi.setSystemTime(new Date("2024-01-15T10:00:00Z"));

    const oldNotification1 = getMockNotification({
      sentAt: new Date("2023-01-01T10:00:00Z"),
    });

    const oldNotification2 = getMockNotification({
      sentAt: new Date("2023-02-01T10:00:00Z"),
    });

    await addScheduledNotifications([oldNotification1, oldNotification2]);

    const deletedCount = await deleteOldNotifications(
      scheduledNotificationDB,
      90,
      loggerInstance
    );

    expect(deletedCount).toBe(2);

    const remainingNotifications = await scheduledNotificationDB
      .select()
      .from(scheduledNotification);

    expect(remainingNotifications).toHaveLength(0);
  });

  it("should not delete any notifications when all are newer than specified days", async () => {
    vi.setSystemTime(new Date("2024-01-15T10:00:00Z"));

    const recentNotification1 = getMockNotification({
      sentAt: new Date("2024-01-01T10:00:00Z"), // 14 days old
    });

    const recentNotification2 = getMockNotification({
      sentAt: new Date("2024-01-10T10:00:00Z"), // 5 days old
    });

    await addScheduledNotifications([recentNotification1, recentNotification2]);

    const deletedCount = await deleteOldNotifications(
      scheduledNotificationDB,
      90,
      loggerInstance
    );

    expect(deletedCount).toBe(0);

    const remainingNotifications = await scheduledNotificationDB
      .select()
      .from(scheduledNotification);

    expect(remainingNotifications).toHaveLength(2);
  });

  it("should handle empty database", async () => {
    const deletedCount = await deleteOldNotifications(
      scheduledNotificationDB,
      90,
      loggerInstance
    );

    expect(deletedCount).toBe(0);
  });

  it("should respect custom retention period", async () => {
    vi.setSystemTime(new Date("2024-01-15T10:00:00Z"));

    const notification30DaysOld = getMockNotification({
      sentAt: new Date("2023-12-16T10:00:00Z"), // 30 days old
    });

    const notification60DaysOld = getMockNotification({
      sentAt: new Date("2023-11-16T10:00:00Z"), // 60 days old
    });

    const notification120DaysOld = getMockNotification({
      sentAt: new Date("2023-09-17T10:00:00Z"), // 120 days old
    });

    await addScheduledNotifications([
      notification30DaysOld,
      notification60DaysOld,
      notification120DaysOld,
    ]);

    // Delete notifications older than 45 days
    const deletedCount = await deleteOldNotifications(
      scheduledNotificationDB,
      45,
      loggerInstance
    );

    expect(deletedCount).toBe(2);

    const remainingNotifications = await scheduledNotificationDB
      .select()
      .from(scheduledNotification);

    expect(remainingNotifications).toHaveLength(1);
    expect(remainingNotifications[0].id).toBe(notification30DaysOld.id);
  });

  it("should delete notifications regardless of send at", async () => {
    vi.setSystemTime(new Date("2024-01-15T10:00:00Z"));

    const oldReadNotification = getMockNotification({
      sentAt: new Date("2023-10-01T10:00:00Z"),
      sendAt: new Date("2023-10-02T10:00:00Z"),
    });

    const oldUnreadNotification = getMockNotification({
      sentAt: new Date("2023-10-05T10:00:00Z"),
      sendAt: undefined,
    });

    await addScheduledNotifications([
      oldReadNotification,
      oldUnreadNotification,
    ]);

    const deletedCount = await deleteOldNotifications(
      scheduledNotificationDB,
      90,
      loggerInstance
    );

    expect(deletedCount).toBe(2);

    const remainingNotifications = await scheduledNotificationDB
      .select()
      .from(scheduledNotification);

    expect(remainingNotifications).toHaveLength(0);
  });

  it("should handle edge case at exact cutoff date", async () => {
    vi.setSystemTime(new Date("2024-01-15T10:00:00Z"));

    // Notification created exactly 90 days ago
    const notificationAtCutoff = getMockNotification({
      sentAt: new Date("2023-10-17T10:00:00Z"), // Exactly 90 days
    });

    // Notification created 91 days ago
    const notificationBeyondCutoff = getMockNotification({
      sentAt: new Date("2023-10-16T10:00:00Z"), // 91 days
    });

    // Notification created 89 days ago
    const notificationBeforeCutoff = getMockNotification({
      sentAt: new Date("2023-10-18T10:00:00Z"), // 89 days
    });

    await addScheduledNotifications([
      notificationAtCutoff,
      notificationBeyondCutoff,
      notificationBeforeCutoff,
    ]);

    const deletedCount = await deleteOldNotifications(
      scheduledNotificationDB,
      90,
      loggerInstance
    );

    // Should delete notifications older than 90 days (not including exactly 90 days)
    expect(deletedCount).toBe(1);

    const remainingNotifications = await scheduledNotificationDB
      .select()
      .from(scheduledNotification);

    expect(remainingNotifications).toHaveLength(2);
  });
});
