import { describe, it, expect, vi, beforeEach } from "vitest";
import { TenantNotificationConfig, generateId } from "pagopa-interop-models";
import {
  generateToken,
  mockTokenOrganizationId,
  getMockTenantNotificationConfig,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { notificationConfigApi } from "pagopa-interop-api-clients";
import { api, notificationConfigService } from "../vitest.api.setup.js";
import { tenantNotificationConfigToApiTenantNotificationConfig } from "../../src/model/domain/apiConverter.js";
import { tenantNotificationConfigNotFound } from "../../src/model/domain/errors.js";
import { expectedOrganizationId } from "../utils.js";

describe("API GET /tenantNotificationConfigs test", () => {
  const tenantId = mockTokenOrganizationId;
  const serviceResponse: TenantNotificationConfig = {
    ...getMockTenantNotificationConfig(),
    tenantId,
  };
  const apiResponse: notificationConfigApi.TenantNotificationConfig =
    tenantNotificationConfigToApiTenantNotificationConfig(serviceResponse);

  const makeRequest = async (token: string) =>
    request(api)
      .get("/tenantNotificationConfigs")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  beforeEach(() => {
    notificationConfigService.getTenantNotificationConfig = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
      expect(
        notificationConfigService.getTenantNotificationConfig
      ).toHaveBeenCalledWith(expectedOrganizationId(tenantId));
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
    expect(
      notificationConfigService.getTenantNotificationConfig
    ).not.toHaveBeenCalled();
  });

  it("Should return 404 for tenantNotificationConfigNotFound", async () => {
    notificationConfigService.getTenantNotificationConfig = vi
      .fn()
      .mockRejectedValue(tenantNotificationConfigNotFound(tenantId));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
    expect(
      notificationConfigService.getTenantNotificationConfig
    ).toHaveBeenCalledWith(expectedOrganizationId(tenantId));
  });
});
