import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserNotificationConfig, generateId } from "pagopa-interop-models";
import {
  generateToken,
  getMockNotificationConfig,
  getMockUserNotificationConfig,
  mockTokenOrganizationId,
  mockTokenUserId,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { notificationConfigApi } from "pagopa-interop-api-clients";
import { api, notificationConfigService } from "../vitest.api.setup.js";
import { userNotificationConfigToApiUserNotificationConfig } from "../../src/model/domain/apiConverter.js";
import { expectedUserIdAndOrganizationId } from "../utils.js";
import { userNotificationConfigNotFound } from "../../src/model/domain/errors.js";

describe("API POST /userNotificationConfigs test", () => {
  const userId = mockTokenUserId;
  const tenantId = mockTokenOrganizationId;
  const notificationConfigSeed: notificationConfigApi.UserNotificationConfigUpdateSeed =
    {
      inAppConfig: getMockNotificationConfig(),
      emailConfig: getMockNotificationConfig(),
    };
  const serviceResponse: UserNotificationConfig = {
    ...getMockUserNotificationConfig(),
    userId,
    tenantId,
    ...notificationConfigSeed,
  };
  const apiResponse: notificationConfigApi.UserNotificationConfig =
    userNotificationConfigToApiUserNotificationConfig(serviceResponse);

  const makeRequest = async (
    token: string,
    body: notificationConfigApi.UserNotificationConfigUpdateSeed = notificationConfigSeed
  ) =>
    request(api)
      .post("/userNotificationConfigs")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  beforeEach(() => {
    notificationConfigService.updateUserNotificationConfig = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE, authRole.API_ROLE];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
      expect(
        notificationConfigService.updateUserNotificationConfig
      ).toHaveBeenCalledWith(
        notificationConfigSeed,
        expectedUserIdAndOrganizationId(userId, tenantId)
      );
    }
  );

  it("Should return 404 for userNotificationConfigNotFound", async () => {
    notificationConfigService.updateUserNotificationConfig = vi
      .fn()
      .mockRejectedValue(userNotificationConfigNotFound(userId, tenantId));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
    expect(
      notificationConfigService.updateUserNotificationConfig
    ).toHaveBeenCalledWith(
      notificationConfigSeed,
      expectedUserIdAndOrganizationId(userId, tenantId)
    );
  });

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
    expect(
      notificationConfigService.updateUserNotificationConfig
    ).not.toHaveBeenCalled();
  });

  it.each([
    { body: {} },
    { body: { ...notificationConfigSeed, inAppConfig: undefined } },
    { body: { ...notificationConfigSeed, emailConfig: undefined } },
    {
      body: {
        ...notificationConfigSeed,
        inAppConfig: {
          ...notificationConfigSeed.inAppConfig,
          newEServiceVersionPublished: "invalid",
        },
      },
    },
    { body: { ...notificationConfigSeed, extraField: 1 } },
  ])("Should return 400 if passed invalid params: %s", async ({ body }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      body as notificationConfigApi.UserNotificationConfigUpdateSeed
    );
    expect(res.status).toBe(400);
    expect(
      notificationConfigService.updateUserNotificationConfig
    ).not.toHaveBeenCalledWith();
  });
});
