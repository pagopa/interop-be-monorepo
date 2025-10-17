import { describe, it, expect, vi, beforeEach } from "vitest";
import { TenantId, UserId, generateId, userRole } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, notificationConfigService } from "../vitest.api.setup.js";
import {
  userNotificationConfigNotFound,
  userRoleNotInUserNotificationConfig,
} from "../../src/model/domain/errors.js";

describe("API DELETE /internal/userNotificationConfigs/tenantId/{tenantId}/userId/{userId}/userRole/{userRole} test", () => {
  const defaultTenantId: TenantId = generateId();
  const defaultUserId: UserId = generateId();
  const defaultUserRole = userRole.ADMIN_ROLE;

  const makeRequest = async (
    token: string,
    tenantId: TenantId = defaultTenantId,
    userId: UserId = defaultUserId,
    role: string = "ADMIN"
  ) =>
    request(api)
      .delete(
        `/internal/userNotificationConfigs/tenantId/${tenantId}/userId/${userId}/userRole/${role}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  beforeEach(() => {
    notificationConfigService.removeUserNotificationConfigRole = vi
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
        notificationConfigService.removeUserNotificationConfigRole
      ).toHaveBeenCalledWith(
        defaultUserId,
        defaultTenantId,
        defaultUserRole,
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
      notificationConfigService.removeUserNotificationConfigRole
    ).not.toHaveBeenCalled();
  });

  it.each([
    {
      error: userNotificationConfigNotFound(defaultUserId, defaultTenantId),
      expectedStatus: 404,
    },
    {
      error: userRoleNotInUserNotificationConfig(
        defaultUserId,
        defaultTenantId,
        defaultUserRole
      ),
      expectedStatus: 404,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      notificationConfigService.removeUserNotificationConfigRole = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.INTERNAL_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { tenantId: "invalid" as TenantId },
    { userId: "invalid" as UserId },
    { role: "invalid" },
  ])(
    "Should return 400 if passed invalid params: %s",
    async ({ tenantId, userId, role }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, tenantId, userId, role);
      expect(res.status).toBe(400);
      expect(
        notificationConfigService.removeUserNotificationConfigRole
      ).not.toHaveBeenCalledWith();
    }
  );
});
