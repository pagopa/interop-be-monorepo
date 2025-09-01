/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, inAppNotificationService } from "../vitest.api.setup.js";

describe("API POST /notifications/bulk/markAsUnread", () => {
  const notificationIds = [generateId(), generateId()];
  const makeRequest = async (token: string, ids: string[] = notificationIds) =>
    request(api)
      .post("/notifications/bulk/markAsUnread")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({ ids });

  beforeEach(() => {
    vi.clearAllMocks();
    inAppNotificationService.markNotificationsAsUnread = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE, authRole.API_ROLE];
  it.each(authorizedRoles)(
    "Should return 204 when marking notifications as unread with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(204);
      expect(
        inAppNotificationService.markNotificationsAsUnread
      ).toHaveBeenCalledWith(notificationIds, expect.any(Object));
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
    expect(
      inAppNotificationService.markNotificationsAsUnread
    ).not.toHaveBeenCalled();
  });

  it("Should return 204 when marking empty array of notifications as unread", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, []);

    expect(res.status).toBe(204);
    expect(
      inAppNotificationService.markNotificationsAsUnread
    ).toHaveBeenCalled();
  });
});
