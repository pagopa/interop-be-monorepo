/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateMock } from "@anatine/zod-mock";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import {
  generateToken,
  mockTokenOrganizationId,
  mockTokenUserId,
  getMockNotificationConfig,
} from "pagopa-interop-commons-test";
import { bffApi, notificationConfigApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { expectedUserIdAndOrganizationId } from "../../utils.js";

describe("API POST /userNotificationConfigs", () => {
  const userId = mockTokenUserId;
  const tenantId = mockTokenOrganizationId;

  const {
    clientKeyAddedDeletedToClientUsers: mockClientKeyAddedDeletedToClientUsers,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    clientKeyConsumerAddedDeletedToClientUsers: _c,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    producerKeychainKeyAddedDeletedToClientUsers: _,
    ...restConfigMock
  } = getMockNotificationConfig();

  const notificationConfigSeed: bffApi.UserNotificationConfigUpdateSeed = {
    inAppNotificationPreference: true,
    emailNotificationPreference: true,
    emailDigestPreference: false,
    inAppConfig: {
      ...restConfigMock,
      clientKeyAndProducerKeychainKeyAddedDeletedToClientUsers:
        mockClientKeyAddedDeletedToClientUsers,
    },
    emailConfig: {
      ...restConfigMock,
      clientKeyAndProducerKeychainKeyAddedDeletedToClientUsers:
        mockClientKeyAddedDeletedToClientUsers,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(
      notificationConfigApi.updateUserNotificationConfig
    ).mockResolvedValue({
      data: generateMock(notificationConfigApi.zUserNotificationConfig),
      error: undefined,
      request: new Request("http://test"),
      response: new Response(),
    });
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
      notificationConfigApi.updateUserNotificationConfig
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          inAppNotificationPreference:
            notificationConfigSeed.inAppNotificationPreference,
          emailNotificationPreference:
            notificationConfigSeed.emailNotificationPreference,
          emailDigestPreference: notificationConfigSeed.emailDigestPreference,
          inAppConfig: {
            ...restConfigMock,
            clientKeyAddedDeletedToClientUsers:
              mockClientKeyAddedDeletedToClientUsers,
            clientKeyConsumerAddedDeletedToClientUsers:
              mockClientKeyAddedDeletedToClientUsers,
            producerKeychainKeyAddedDeletedToClientUsers:
              mockClientKeyAddedDeletedToClientUsers,
          },
          emailConfig: {
            ...restConfigMock,
            clientKeyAddedDeletedToClientUsers:
              mockClientKeyAddedDeletedToClientUsers,
            clientKeyConsumerAddedDeletedToClientUsers:
              mockClientKeyAddedDeletedToClientUsers,
            producerKeychainKeyAddedDeletedToClientUsers:
              mockClientKeyAddedDeletedToClientUsers,
          },
        },
      })
    );
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
      notificationConfigApi.updateUserNotificationConfig
    ).not.toHaveBeenCalled();
  });
});
