import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  TenantId,
  UserId,
  UserNotificationConfig,
  generateId,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockNotificationConfig,
  getMockUserNotificationConfig,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { notificationConfigApi } from "pagopa-interop-api-clients";
import { api, notificationConfigService } from "../vitest.api.setup.js";
import { userNotificationConfigToApiUserNotificationConfig } from "../../src/model/domain/apiConverter.js";
import { userNotificationConfigAlreadyExists } from "../../src/model/domain/errors.js";

describe("API POST /internal/userNotificationConfigs test", () => {
  const defaultTenantId: TenantId = generateId();
  const defaultUserId: UserId = generateId();
  const notificationConfigSeed: notificationConfigApi.UserNotificationConfigSeed =
    {
      userId: defaultUserId,
      tenantId: defaultTenantId,
      inAppConfig: getMockNotificationConfig(),
      emailConfig: getMockNotificationConfig(),
    };
  const serviceResponse: UserNotificationConfig = {
    ...getMockUserNotificationConfig(),
    ...notificationConfigSeed,
    userId: defaultUserId,
    tenantId: defaultTenantId,
  };
  const apiResponse: notificationConfigApi.UserNotificationConfig =
    userNotificationConfigToApiUserNotificationConfig(serviceResponse);

  const makeRequest = async (
    token: string,
    body: notificationConfigApi.UserNotificationConfigSeed = notificationConfigSeed
  ) =>
    request(api)
      .post("/internal/userNotificationConfigs")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  beforeEach(() => {
    notificationConfigService.createUserNotificationConfig = vi
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
        notificationConfigService.createUserNotificationConfig
      ).toHaveBeenCalledWith(
        {
          userId: defaultUserId,
          tenantId: defaultTenantId,
          inAppConfig: notificationConfigSeed.inAppConfig,
          emailConfig: notificationConfigSeed.emailConfig,
        },
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
      notificationConfigService.createUserNotificationConfig
    ).not.toHaveBeenCalled();
  });

  it("Should return 409 for userNotificationConfigAlreadyExists", async () => {
    notificationConfigService.createUserNotificationConfig = vi
      .fn()
      .mockRejectedValue(
        userNotificationConfigAlreadyExists(defaultUserId, defaultTenantId)
      );
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(409);
    expect(
      notificationConfigService.createUserNotificationConfig
    ).toHaveBeenCalledWith(
      {
        userId: defaultUserId,
        tenantId: defaultTenantId,
        inAppConfig: notificationConfigSeed.inAppConfig,
        emailConfig: notificationConfigSeed.emailConfig,
      },
      expect.any(Object)
    );
  });

  it.each([
    { body: {} },
    { body: { ...notificationConfigSeed, userId: undefined } },
    { body: { ...notificationConfigSeed, tenantId: undefined } },
    { body: { ...notificationConfigSeed, inAppConfig: undefined } },
    { body: { ...notificationConfigSeed, emailConfig: undefined } },
    { body: { ...notificationConfigSeed, userId: "invalid" as UserId } },
    { body: { ...notificationConfigSeed, tenantId: "invalid" as TenantId } },
    {
      body: {
        ...notificationConfigSeed,
        inAppConfig: { newEServiceVersionPublished: "invalid" },
      },
    },
    {
      body: {
        ...notificationConfigSeed,
        emailConfig: { newEServiceVersionPublished: "invalid" },
      },
    },
    { body: { ...notificationConfigSeed, extraField: 1 } },
  ])("Should return 400 if passed invalid params: %s", async ({ body }) => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(
      token,
      body as notificationConfigApi.UserNotificationConfigSeed
    );
    expect(res.status).toBe(400);
    expect(
      notificationConfigService.createUserNotificationConfig
    ).not.toHaveBeenCalledWith();
  });
});
