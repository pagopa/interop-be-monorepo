import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  TenantId,
  TenantNotificationConfig,
  generateId,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockNotificationConfig,
  getMockTenantNotificationConfig,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { notificationConfigApi } from "pagopa-interop-api-clients";
import { api, notificationConfigService } from "../vitest.api.setup.js";
import { tenantNotificationConfigToApiTenantNotificationConfig } from "../../src/model/domain/apiConverter.js";
import { tenantNotificationConfigAlreadyExists } from "../../src/model/domain/errors.js";

describe("API POST /internal/tenantNotificationConfigs/{tenantId} test", () => {
  const defaultTenantId: TenantId = generateId();
  const notificationConfigSeed: notificationConfigApi.NotificationConfigSeed =
    getMockNotificationConfig();
  const serviceResponse: TenantNotificationConfig = {
    ...getMockTenantNotificationConfig(),
    tenantId: defaultTenantId,
    config: notificationConfigSeed,
  };
  const apiResponse: notificationConfigApi.TenantNotificationConfig =
    tenantNotificationConfigToApiTenantNotificationConfig(serviceResponse);

  const makeRequest = async (
    token: string,
    tenantId: TenantId = defaultTenantId,
    body: notificationConfigApi.NotificationConfigSeed = notificationConfigSeed
  ) =>
    request(api)
      .post(`/internal/tenantNotificationConfigs/${tenantId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  beforeEach(() => {
    notificationConfigService.createTenantNotificationConfig = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const authorizedRoles: AuthRole[] = [authRole.INTERNAL_ROLE];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
      expect(
        notificationConfigService.createTenantNotificationConfig
      ).toHaveBeenCalledWith(
        defaultTenantId,
        notificationConfigSeed,
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
      notificationConfigService.createTenantNotificationConfig
    ).not.toHaveBeenCalled();
  });

  it("Should return 409 for tenantNotificationConfigAlreadyExists", async () => {
    notificationConfigService.createTenantNotificationConfig = vi
      .fn()
      .mockRejectedValue(
        tenantNotificationConfigAlreadyExists(defaultTenantId)
      );
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(409);
    expect(
      notificationConfigService.createTenantNotificationConfig
    ).toHaveBeenCalledWith(
      defaultTenantId,
      notificationConfigSeed,
      expect.any(Object)
    );
  });

  it.each([
    { tenantId: "invalid" as TenantId },
    { body: {} },
    { body: { newEServiceVersionPublished: "invalid" } },
    { body: { ...notificationConfigSeed, extraField: 1 } },
  ])(
    "Should return 400 if passed invalid params: %s",
    async ({ tenantId, body }) => {
      const token = generateToken(authRole.INTERNAL_ROLE);
      const res = await makeRequest(
        token,
        tenantId,
        body as notificationConfigApi.NotificationConfigSeed
      );
      expect(res.status).toBe(400);
      expect(
        notificationConfigService.createTenantNotificationConfig
      ).not.toHaveBeenCalledWith();
    }
  );
});
