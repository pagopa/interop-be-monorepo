/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import {
  generateToken,
  mockTokenOrganizationId,
} from "pagopa-interop-commons-test";
import { bffApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { api, clients, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { expectedOrganizationId } from "../../utils.js";

describe("API POST /tenantNotificationConfigs", () => {
  const tenantId = mockTokenOrganizationId;
  const notificationConfigSeed: bffApi.TenantNotificationConfigUpdateSeed = {
    enabled: true,
  };

  beforeEach(() => {
    clients.notificationConfigProcessClient.updateTenantNotificationConfig = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    body: bffApi.TenantNotificationConfigUpdateSeed = notificationConfigSeed
  ) =>
    request(api)
      .post(`${appBasePath}/tenantNotificationConfigs`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 if no error is thrown", async () => {
    const serviceSpy = vi.spyOn(
      services.notificationConfigService,
      "updateTenantNotificationConfig"
    );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
    expect(serviceSpy).toHaveBeenCalledWith(
      notificationConfigSeed,
      expectedOrganizationId(tenantId)
    );
    expect(
      clients.notificationConfigProcessClient.updateTenantNotificationConfig
    ).toHaveBeenCalledWith(notificationConfigSeed, expect.any(Object));
  });

  it.each([
    { body: {} },
    { body: { enabled: "invalid" } },
    { body: { ...notificationConfigSeed, extraField: 1 } },
  ])("Should return 400 if passed invalid params: %s", async ({ body }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      body as bffApi.TenantNotificationConfigUpdateSeed
    );
    expect(res.status).toBe(400);
    expect(
      clients.notificationConfigProcessClient.updateTenantNotificationConfig
    ).not.toHaveBeenCalledWith();
  });
});
