import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { generateMock } from "@anatine/zod-mock";
import { TenantNotificationConfig, generateId } from "pagopa-interop-models";
import {
  generateToken,
  mockTokenOrganizationId,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { notificationConfigApi } from "pagopa-interop-api-clients";
import { api, notificationConfigService } from "../vitest.api.setup.js";
import { tenantNotificationConfigToApiTenantNotificationConfig } from "../../src/model/domain/apiConverter.js";
import { expectedOrganizationId } from "../utils.js";

describe("API POST /tenantNotificationConfigs test", () => {
  const tenantId = mockTokenOrganizationId;
  const notificationConfigSeed: notificationConfigApi.NotificationConfigSeed = {
    newEServiceVersionPublished: true,
  };
  const serviceResponse: TenantNotificationConfig = {
    id: generateId(),
    tenantId,
    config: notificationConfigSeed,
    createdAt: generateMock(z.coerce.date()),
    updatedAt: generateMock(z.coerce.date().optional()),
  };
  const apiResponse: notificationConfigApi.TenantNotificationConfig =
    tenantNotificationConfigToApiTenantNotificationConfig(serviceResponse);

  const makeRequest = async (
    token: string,
    body: notificationConfigApi.NotificationConfigSeed = notificationConfigSeed
  ) =>
    request(api)
      .post("/tenantNotificationConfigs")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  beforeEach(() => {
    notificationConfigService.updateTenantNotificationConfig = vi
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
        notificationConfigService.updateTenantNotificationConfig
      ).toHaveBeenCalledWith(
        notificationConfigSeed,
        expectedOrganizationId(tenantId)
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
      notificationConfigService.updateTenantNotificationConfig
    ).not.toHaveBeenCalled();
  });

  it.each([
    { body: {} },
    { body: { newEServiceVersionPublished: "invalid" } },
    { body: { ...notificationConfigSeed, extraField: 1 } },
  ])("Should return 400 if passed invalid params: %s", async ({ body }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      body as notificationConfigApi.NotificationConfigSeed
    );
    expect(res.status).toBe(400);
    expect(
      notificationConfigService.updateTenantNotificationConfig
    ).not.toHaveBeenCalledWith();
  });
});
