/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateMock } from "@anatine/zod-mock";
import { generateId } from "pagopa-interop-models";
import {
  generateToken,
  mockTokenOrganizationId,
} from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { bffApi, notificationConfigApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { expectedOrganizationId } from "../../utils.js";

describe("API GET /tenantNotificationConfigs", () => {
  const tenantId = mockTokenOrganizationId;
  const clientResponse: notificationConfigApi.TenantNotificationConfig =
    generateMock(notificationConfigApi.zTenantNotificationConfig);
  const apiResponse: bffApi.TenantNotificationConfig = {
    enabled: clientResponse.enabled,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(
      notificationConfigApi.getTenantNotificationConfig
    ).mockResolvedValue({
      data: clientResponse,
      error: undefined,
      request: new Request("http://test"),
      response: new Response(),
    });
  });

  const makeRequest = async (token: string) =>
    request(api)
      .get(`${appBasePath}/tenantNotificationConfigs`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 for user with role Admin", async () => {
    const serviceSpy = vi.spyOn(
      services.notificationConfigService,
      "getTenantNotificationConfig"
    );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(apiResponse);
    expect(serviceSpy).toHaveBeenCalledWith(expectedOrganizationId(tenantId));
    expect(
      notificationConfigApi.getTenantNotificationConfig
    ).toHaveBeenCalled();
  });
});
