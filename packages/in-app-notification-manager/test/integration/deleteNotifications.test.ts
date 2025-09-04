import { generateId, UserId, TenantId } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { getMockAuthData, getMockContext } from "pagopa-interop-commons-test";
import { notification } from "pagopa-interop-in-app-notification-db-models";
import {
  addNotifications,
  getMockNotification,
  inAppNotificationDB,
  inAppNotificationService,
} from "../integrationUtils.js";

describe("deleteNotifications", () => {
  const userId: UserId = generateId();
  const tenantId: TenantId = generateId();

  it("should delete a list of notifications", async () => {
    const notificationsList = Array.from({ length: 10 }, (_, i) =>
      getMockNotification({
        userId,
        tenantId,
        body: `Notification ${i}`,
      })
    );
    await addNotifications(notificationsList);

    // Delete first 5 notifications
    const idsToDelete = notificationsList.slice(0, 5).map((n) => n.id);
    await inAppNotificationService.deleteNotifications(
      idsToDelete,
      getMockContext({
        authData: {
          ...getMockAuthData(tenantId),
          userId,
        },
      })
    );

    // Verify deleted notifications are gone
    const remainingNotifications = await inAppNotificationDB
      .select()
      .from(notification);
    expect(remainingNotifications).toHaveLength(5);

    // Verify the correct notifications were deleted
    const remainingIds = remainingNotifications.map((n) => n.id);
    idsToDelete.forEach((deletedId) => {
      expect(remainingIds).not.toContain(deletedId);
    });
  });
});
