import { describe, it, expect, vi, beforeEach } from "vitest";
import { TenantId, UserId, generateId, userRole } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { notificationConfigApi } from "pagopa-interop-api-clients";
import { api, notificationConfigService } from "../vitest.api.setup.js";

describe("API POST /internal/ensureUserNotificationConfigExistsWithRole test", () => {
  const defaultTenantId: TenantId = generateId();
  const defaultUserId: UserId = generateId();
  const defaultUserRole = userRole.ADMIN_ROLE;
  const notificationConfigSeed: notificationConfigApi.UserNotificationConfigSeed =
    {
      userId: defaultUserId,
      tenantId: defaultTenantId,
      userRole: "ADMIN",
    };

  const makeRequest = async (
    token: string,
    body: notificationConfigApi.UserNotificationConfigSeed = notificationConfigSeed
  ) =>
    request(api)
      .post("/internal/ensureUserNotificationConfigExistsWithRole")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  beforeEach(() => {
    notificationConfigService.ensureUserNotificationConfigExistsWithRole = vi
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
        notificationConfigService.ensureUserNotificationConfigExistsWithRole
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
      notificationConfigService.ensureUserNotificationConfigExistsWithRole
    ).not.toHaveBeenCalled();
  });

  it.each([
    { body: {} },
    { body: { ...notificationConfigSeed, userId: undefined } },
    { body: { ...notificationConfigSeed, tenantId: undefined } },
    { body: { ...notificationConfigSeed, userRole: undefined } },
    { body: { ...notificationConfigSeed, userId: "invalid" as UserId } },
    { body: { ...notificationConfigSeed, tenantId: "invalid" as TenantId } },
    { body: { ...notificationConfigSeed, userRole: "invalid" } },
    { body: { ...notificationConfigSeed, extraField: 1 } },
  ])("Should return 400 if passed invalid params: %s", async ({ body }) => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(
      token,
      body as notificationConfigApi.UserNotificationConfigSeed
    );
    expect(res.status).toBe(400);
    expect(
      notificationConfigService.ensureUserNotificationConfigExistsWithRole
    ).not.toHaveBeenCalledWith();
  });
});
