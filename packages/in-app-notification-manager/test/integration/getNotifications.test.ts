import { describe, it, expect } from "vitest";

import { getMockContext } from "pagopa-interop-commons-test";
import { getMockAuthData } from "pagopa-interop-commons-test";
import { generateId, UserId, TenantId } from "pagopa-interop-models";
import {
  addOneNotification,
  inAppNotificationService,
} from "../integrationUtils.js";
import { Notification } from "../../src/db/schema.js";

describe("getNotifications", () => {
  it("should return the list of notifications", async () => {
    const userId: UserId = generateId();
    const tenantId: TenantId = generateId();

    const notification: Notification = {
      id: generateId(),
      userId,
      tenantId,
      body: "test",
      deepLink: "test",
      readAt: null,
      createdAt: new Date().toISOString(),
    };
    await addOneNotification(notification);

    const notifications = await inAppNotificationService.getNotifications(
      undefined,
      10,
      0,
      getMockContext({
        authData: {
          ...getMockAuthData(tenantId),
          userId,
        },
      })
    );
    expect(notifications).toBeDefined();
    expect(notifications.results).toEqual([notification]);
    expect(notifications.totalCount).toBe(1);
  });
});
