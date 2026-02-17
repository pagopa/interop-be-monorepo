import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  TenantId,
  TenantNotificationConfig,
  generateId,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockTenantNotificationConfig,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { notificationConfigApi } from "pagopa-interop-api-clients";
import { app, notificationConfigService } from "../vitest.api.setup.js";
import { tenantNotificationConfigToApiTenantNotificationConfig } from "../../src/model/domain/apiConverter.js";
import { tenantNotificationConfigAlreadyExists } from "../../src/model/domain/errors.js";

describe("API POST /internal/tenantNotificationConfigs test", () => {
  const defaultTenantId: TenantId = generateId();
  const notificationConfigSeed: notificationConfigApi.TenantNotificationConfigSeed =
    {
      tenantId: defaultTenantId,
    };
  const serviceResponse: TenantNotificationConfig = {
    ...getMockTenantNotificationConfig(),
    tenantId: defaultTenantId,
    enabled: true,
  };
  const apiResponse: notificationConfigApi.TenantNotificationConfig =
    tenantNotificationConfigToApiTenantNotificationConfig(serviceResponse);

  const makeRequest = async (
    token: string,
    body: notificationConfigApi.TenantNotificationConfigSeed = notificationConfigSeed
  ) =>
    app.inject({
      method: "POST",
      url: "/internal/tenantNotificationConfigs",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Correlation-Id": generateId(),
      },
      payload: body,
    });

  beforeEach(() => {
    notificationConfigService.createTenantDefaultNotificationConfig = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const authorizedRoles: AuthRole[] = [authRole.INTERNAL_ROLE];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual(apiResponse);
      expect(
        notificationConfigService.createTenantDefaultNotificationConfig
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
      notificationConfigService.createTenantDefaultNotificationConfig
    ).not.toHaveBeenCalled();
  });

  it("Should return 409 for tenantNotificationConfigAlreadyExists", async () => {
    notificationConfigService.createTenantDefaultNotificationConfig = vi
      .fn()
      .mockRejectedValue(
        tenantNotificationConfigAlreadyExists(defaultTenantId)
      );
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);
    expect(res.statusCode).toBe(409);
    expect(
      notificationConfigService.createTenantDefaultNotificationConfig
    ).toHaveBeenCalledWith(defaultTenantId, expect.any(Object));
  });

  it.each([
    { body: {} },
    { body: { tenantId: "invalid" as TenantId } },
    { body: { ...notificationConfigSeed, extraField: 1 } },
  ])("Should return 400 if passed invalid params: %s", async ({ body }) => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(
      token,
      body as notificationConfigApi.TenantNotificationConfigSeed
    );
    expect(res.statusCode).toBe(400);
    expect(
      notificationConfigService.createTenantDefaultNotificationConfig
    ).not.toHaveBeenCalledWith();
  });
});
