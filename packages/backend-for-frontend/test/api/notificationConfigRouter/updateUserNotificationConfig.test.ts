/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import {
  generateToken,
  mockTokenOrganizationId,
  mockTokenUserId,
  getMockNotificationConfig,
} from "pagopa-interop-commons-test";
import { bffApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { api, clients, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { expectedUserIdAndOrganizationId } from "../../utils.js";

describe("API POST /userNotificationConfigs", () => {
  const userId = mockTokenUserId;
  const tenantId = mockTokenOrganizationId;
  const notificationConfigSeed: bffApi.UserNotificationConfigUpdateSeed = {
    inAppNotificationPreference: true,
    emailNotificationPreference: "ENABLED",
    inAppConfig: getMockNotificationConfig(),
    emailConfig: getMockNotificationConfig(),
  };

  beforeEach(() => {
    clients.notificationConfigProcessClient.updateUserNotificationConfig = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    body: bffApi.UserNotificationConfigUpdateSeed = notificationConfigSeed
  ) =>
    request(api)
      .post(`${appBasePath}/userNotificationConfigs`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 if no error is thrown", async () => {
    const serviceSpy = vi.spyOn(
      services.notificationConfigService,
      "updateUserNotificationConfig"
    );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
    expect(serviceSpy).toHaveBeenCalledWith(
      notificationConfigSeed,
      expectedUserIdAndOrganizationId(userId, tenantId)
    );
    expect(
      clients.notificationConfigProcessClient.updateUserNotificationConfig
    ).toHaveBeenCalledWith(notificationConfigSeed, expect.any(Object));
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
      body as bffApi.UserNotificationConfigUpdateSeed
    );
    expect(res.status).toBe(400);
    expect(
      clients.notificationConfigProcessClient.updateUserNotificationConfig
    ).not.toHaveBeenCalledWith();
  });
});
