import {
  getMockContext,
  getMockAuthData,
  getMockUserNotificationConfig,
} from "pagopa-interop-commons-test";
import {
  generateId,
  TenantId,
  UserId,
  UserNotificationConfig,
} from "pagopa-interop-models";
import { beforeAll, describe, expect, it } from "vitest";
import {
  addOneUserNotificationConfig,
  notificationConfigService,
} from "../integrationUtils.js";
import { userNotificationConfigNotFound } from "../../src/model/domain/errors.js";

describe("getUserNotificationConfig", () => {
  const tenantId: TenantId = generateId();
  const userId: UserId = generateId();
  const userNotificationConfig: UserNotificationConfig = {
    ...getMockUserNotificationConfig(),
    userId,
    tenantId,
  };

  beforeAll(async () => {
    await addOneUserNotificationConfig(userNotificationConfig);
    // Extra config to check that the correct one is returned
    await addOneUserNotificationConfig(getMockUserNotificationConfig());
  });

  it("should get the user's notification config", async () => {
    const result = await notificationConfigService.getUserNotificationConfig(
      getMockContext({
        authData: getMockAuthData(tenantId, userId),
      })
    );
    expect(result).toEqual(userNotificationConfig);
  });

  it.each<[string, TenantId, UserId]>([
    ["non-existent user id", tenantId, generateId<UserId>()],
    ["non-existent tenant id", generateId<TenantId>(), userId],
    [
      "non-existent user and tenant id's",
      generateId<TenantId>(),
      generateId<UserId>(),
    ],
  ])(
    "should throw userNotificationConfigNotFound in case of %s",
    async (_, tenantId, userId) => {
      expect(
        notificationConfigService.getUserNotificationConfig(
          getMockContext({
            authData: getMockAuthData(tenantId, userId),
          })
        )
      ).rejects.toThrowError(userNotificationConfigNotFound(userId, tenantId));
    }
  );
});
