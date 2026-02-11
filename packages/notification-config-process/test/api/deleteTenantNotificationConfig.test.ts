import { describe, it, expect, vi, beforeEach } from "vitest";
import { TenantId, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { app, notificationConfigService } from "../vitest.api.setup.js";
import { tenantNotificationConfigNotFound } from "../../src/model/domain/errors.js";

describe("API DELETE /internal/tenantNotificationConfigs/tenantId/{tenantId} test", () => {
  const defaultTenantId: TenantId = generateId();

  const makeRequest = async (
    token: string,
    tenantId: TenantId = defaultTenantId
  ) =>
    app.inject({
      method: "DELETE",
      url: `/internal/tenantNotificationConfigs/tenantId/${tenantId}`,
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Correlation-Id": generateId(),
      },
    });

  beforeEach(() => {
    notificationConfigService.deleteTenantNotificationConfig = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const authorizedRoles: AuthRole[] = [authRole.INTERNAL_ROLE];

  it.each(authorizedRoles)(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.statusCode).toBe(204);
      expect(
        notificationConfigService.deleteTenantNotificationConfig
      ).toHaveBeenCalledWith(defaultTenantId, expect.any(Object));
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.statusCode).toBe(403);
    expect(
      notificationConfigService.deleteTenantNotificationConfig
    ).not.toHaveBeenCalled();
  });

  it("Should return 404 for tenantNotificationConfigNotFound", async () => {
    notificationConfigService.deleteTenantNotificationConfig = vi
      .fn()
      .mockRejectedValue(tenantNotificationConfigNotFound(defaultTenantId));
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);
    expect(res.statusCode).toBe(404);
    expect(
      notificationConfigService.deleteTenantNotificationConfig
    ).toHaveBeenCalledWith(defaultTenantId, expect.any(Object));
  });

  it("Should return 400 if passed an invalid tenant id", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token, "invalid" as TenantId);
    expect(res.statusCode).toBe(400);
    expect(
      notificationConfigService.deleteTenantNotificationConfig
    ).not.toHaveBeenCalledWith();
  });
});
