import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  UserNotificationConfig,
  emailNotificationPreference,
  generateId,
} from "pagopa-interop-models";
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
import {
  notificationConfigNotAllowedForUserRoles,
  userNotificationConfigNotFound,
} from "../../src/model/domain/errors.js";

describe("API POST /userNotificationConfigs test", () => {
  const userId = mockTokenUserId;
  const tenantId = mockTokenOrganizationId;
  const notificationConfigSeed: notificationConfigApi.UserNotificationConfigUpdateSeed =
    {
      inAppNotificationPreference: true,
      emailNotificationPreference: "ENABLED",
      inAppConfig: getMockNotificationConfig(),
      emailConfig: getMockNotificationConfig(),
    };
  const serviceResponse: UserNotificationConfig = {
    ...getMockUserNotificationConfig(),
    userId,
    tenantId,
    ...notificationConfigSeed,
    emailNotificationPreference: emailNotificationPreference.enabled,
    inAppNotificationPreference: true,
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

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.SECURITY_ROLE,
  ];

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

  it.each([
    {
      error: userNotificationConfigNotFound(userId, tenantId),
      expectedStatus: 404,
    },
    {
      error: notificationConfigNotAllowedForUserRoles(userId, tenantId),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      notificationConfigService.updateUserNotificationConfig = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
      expect(
        notificationConfigService.updateUserNotificationConfig
      ).toHaveBeenCalledWith(
        notificationConfigSeed,
        expectedUserIdAndOrganizationId(userId, tenantId)
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
          agreementSuspendedUnsuspendedToProducer: undefined,
        },
      },
    },
    {
      body: {
        ...notificationConfigSeed,
        inAppConfig: {
          ...notificationConfigSeed.inAppConfig,
          agreementSuspendedUnsuspendedToProducer: "invalid",
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
