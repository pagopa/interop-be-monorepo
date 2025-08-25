import { describe, it, expect, vi, beforeEach } from "vitest";
import { TenantId, UserId, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, notificationConfigService } from "../vitest.api.setup.js";
import { userNotificationConfigNotFound } from "../../src/model/domain/errors.js";

describe("API DELETE /internal/userNotificationConfigs/tenantId/{tenantId}/userId/{userId} test", () => {
  const defaultTenantId: TenantId = generateId();
  const defaultUserId: UserId = generateId();

  const makeRequest = async (
    token: string,
    tenantId: TenantId = defaultTenantId,
    userId: UserId = defaultUserId
  ) =>
    request(api)
      .delete(
        `/internal/userNotificationConfigs/tenantId/${tenantId}/userId/${userId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  beforeEach(() => {
    notificationConfigService.deleteUserNotificationConfig = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const authorizedRoles: AuthRole[] = [authRole.INTERNAL_ROLE];

  it.each(authorizedRoles)(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(204);
      expect(
        notificationConfigService.deleteUserNotificationConfig
      ).toHaveBeenCalledWith(
        defaultUserId,
        defaultTenantId,
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
    expect(
      notificationConfigService.deleteUserNotificationConfig
    ).not.toHaveBeenCalled();
  });

  it("Should return 404 for userNotificationConfigNotFound", async () => {
    notificationConfigService.deleteUserNotificationConfig = vi
      .fn()
      .mockRejectedValue(
        userNotificationConfigNotFound(defaultUserId, defaultTenantId)
      );
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
    expect(
      notificationConfigService.deleteUserNotificationConfig
    ).toHaveBeenCalledWith(defaultUserId, defaultTenantId, expect.any(Object));
  });

  it.each([
    { tenantId: "invalid" as TenantId },
    { userId: "invalid" as UserId },
  ])(
    "Should return 400 if passed invalid params: %s",
    async ({ tenantId, userId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, tenantId, userId);
      expect(res.status).toBe(400);
      expect(
        notificationConfigService.deleteUserNotificationConfig
      ).not.toHaveBeenCalledWith();
    }
  );
});
