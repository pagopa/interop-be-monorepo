/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateMock } from "@anatine/zod-mock";
import { generateId } from "pagopa-interop-models";
import {
  generateToken,
  mockTokenOrganizationId,
  mockTokenUserId,
} from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { bffApi, notificationConfigApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { api, clients, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { expectedUserIdAndOrganizationId } from "../../utils.js";

describe("API GET /userNotificationConfigs", () => {
  const userId = mockTokenUserId;
  const tenantId = mockTokenOrganizationId;
  const clientResponse: notificationConfigApi.UserNotificationConfig =
    generateMock(notificationConfigApi.UserNotificationConfig);
  const apiResponse: bffApi.UserNotificationConfig = {
    inAppConfig: clientResponse.inAppConfig,
    emailConfig: clientResponse.emailConfig,
  };

  beforeEach(() => {
    clients.notificationConfigProcessClient.getUserNotificationConfig = vi
      .fn()
      .mockResolvedValue(clientResponse);
  });

  const makeRequest = async (token: string) =>
    request(api)
      .get(`${appBasePath}/userNotificationConfigs`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 for user with role Admin", async () => {
    const serviceSpy = vi.spyOn(
      services.notificationConfigService,
      "getUserNotificationConfig"
    );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(apiResponse);
    expect(serviceSpy).toHaveBeenCalledWith(
      expectedUserIdAndOrganizationId(userId, tenantId)
    );
    expect(
      clients.notificationConfigProcessClient.getUserNotificationConfig
    ).toHaveBeenCalled();
  });
});
