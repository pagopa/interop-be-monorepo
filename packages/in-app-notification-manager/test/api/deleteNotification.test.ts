/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, inAppNotificationService } from "../vitest.api.setup.js";
import { notificationNotFound } from "../../src/model/errors.js";

describe("API DELETE /notifications/:notificationId", () => {
  const notificationId = generateId();
  const makeRequest = async (token: string, id: string = notificationId) =>
    request(api)
      .delete(`/notifications/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  beforeEach(() => {
    vi.clearAllMocks();
    inAppNotificationService.deleteNotification = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.SECURITY_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 204 when deleting notification with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(204);
      expect(inAppNotificationService.deleteNotification).toHaveBeenCalledWith(
        notificationId,
        expect.any(Object)
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
    expect(inAppNotificationService.deleteNotification).not.toHaveBeenCalled();
  });

  it("Should return 404 when notification does not exist", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const nonExistentId = generateId();
    inAppNotificationService.deleteNotification = vi
      .fn()
      .mockRejectedValue(notificationNotFound(nonExistentId));

    const res = await makeRequest(token, nonExistentId);

    expect(res.status).toBe(404);
    expect(inAppNotificationService.deleteNotification).toHaveBeenCalledWith(
      nonExistentId,
      expect.any(Object)
    );
  });

  it("Should return 400 if passed an invalid notification ID", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const invalidId = "invalid-uuid";
    const res = await makeRequest(token, invalidId);

    expect(res.status).toBe(400);
    expect(inAppNotificationService.deleteNotification).not.toHaveBeenCalled();
  });
});
