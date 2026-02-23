import { authRole, notificationAdmittedRoles } from "pagopa-interop-commons";
import {
  getMockContext,
  getMockAuthData,
  getMockUserNotificationConfig,
} from "pagopa-interop-commons-test";
import {
  generateId,
  NotificationConfig,
  NotificationType,
  TenantId,
  UserId,
  UserNotificationConfig,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it } from "vitest";
import {
  addOneUserNotificationConfig,
  notificationConfigService,
} from "../integrationUtils.js";
import { userNotificationConfigNotFound } from "../../src/model/domain/errors.js";

describe("getUserNotificationConfig", () => {
  const tenantId: TenantId = generateId();
  const userId: UserId = generateId();
  const userIdForRoleOverrideTests: UserId = generateId();

  const userNotificationConfig: UserNotificationConfig = {
    ...getMockUserNotificationConfig(),
    userId,
    tenantId,
  };

  const makeNotificationConfig = (
    init: (notificationType: NotificationType) => boolean
  ): NotificationConfig =>
    Object.keys(NotificationConfig.shape).reduce((acc, key) => {
      // eslint-disable-next-line functional/immutable-data
      acc[key as NotificationType] = init(key as NotificationType);
      return acc;
    }, {} as NotificationConfig);

  const configWithAllNotificationTypesEnabled = makeNotificationConfig(
    () => true
  );
  const configWithAllNotificationTypesDisabled = makeNotificationConfig(
    () => false
  );
  const configWithAllAllowedForApi = makeNotificationConfig(
    (notificationType) =>
      notificationAdmittedRoles[notificationType][authRole.API_ROLE]
  );
  const configWithAllAllowedForSecurity = makeNotificationConfig(
    (notificationType) =>
      notificationAdmittedRoles[notificationType][authRole.SECURITY_ROLE]
  );
  const configWithAllAllowedForApiSecurity = makeNotificationConfig(
    (notificationType) =>
      notificationAdmittedRoles[notificationType][authRole.API_ROLE] ||
      notificationAdmittedRoles[notificationType][authRole.SECURITY_ROLE]
  );

  const userNotificationConfigForRoleOverrideTests: UserNotificationConfig = {
    ...getMockUserNotificationConfig(),
    userId: userIdForRoleOverrideTests,
    tenantId,
    inAppConfig: configWithAllNotificationTypesEnabled,
    emailConfig: configWithAllNotificationTypesEnabled,
  };

  beforeEach(async () => {
    await addOneUserNotificationConfig(userNotificationConfig);
    await addOneUserNotificationConfig(
      userNotificationConfigForRoleOverrideTests
    );
    // Extra config to check that the correct one is returned
    await addOneUserNotificationConfig(getMockUserNotificationConfig());
  });

  it("should get an user's notification config if the user has the 'admin' role", async () => {
    // console.log("getting config for userId:", userId);
    const result = await notificationConfigService.getUserNotificationConfig(
      getMockContext({
        authData: getMockAuthData(tenantId, userId, [authRole.ADMIN_ROLE]),
      })
    );
    expect(result).toEqual(userNotificationConfig);
  });

  it("should override not allowed notification types if the user has the 'api' role", async () => {
    const result = await notificationConfigService.getUserNotificationConfig(
      getMockContext({
        authData: getMockAuthData(tenantId, userIdForRoleOverrideTests, [
          authRole.API_ROLE,
        ]),
      })
    );
    const expected: UserNotificationConfig = {
      ...userNotificationConfigForRoleOverrideTests,
      inAppConfig: configWithAllAllowedForApi,
      emailConfig: configWithAllAllowedForApi,
    };
    expect(result).toEqual(expected);
  });

  it("should override not allowed notification types if the user has the 'security' role", async () => {
    const result = await notificationConfigService.getUserNotificationConfig(
      getMockContext({
        authData: getMockAuthData(tenantId, userIdForRoleOverrideTests, [
          authRole.SECURITY_ROLE,
        ]),
      })
    );
    const expected: UserNotificationConfig = {
      ...userNotificationConfigForRoleOverrideTests,
      inAppConfig: configWithAllAllowedForSecurity,
      emailConfig: configWithAllAllowedForSecurity,
    };
    expect(result).toEqual(expected);
  });

  it("should override not allowed notification types if the user has the 'api' and 'security' roles", async () => {
    const result = await notificationConfigService.getUserNotificationConfig(
      getMockContext({
        authData: getMockAuthData(tenantId, userIdForRoleOverrideTests, [
          authRole.API_ROLE,
          authRole.SECURITY_ROLE,
        ]),
      })
    );
    const expected: UserNotificationConfig = {
      ...userNotificationConfigForRoleOverrideTests,
      inAppConfig: configWithAllAllowedForApiSecurity,
      emailConfig: configWithAllAllowedForApiSecurity,
    };
    expect(result).toEqual(expected);
  });

  it("should return all notification types disabled if the user has the 'support' role", async () => {
    const result = await notificationConfigService.getUserNotificationConfig(
      getMockContext({
        authData: getMockAuthData(tenantId, userIdForRoleOverrideTests, [
          authRole.SUPPORT_ROLE,
        ]),
      })
    );
    const expected: UserNotificationConfig = {
      ...userNotificationConfigForRoleOverrideTests,
      inAppConfig: configWithAllNotificationTypesDisabled,
      emailConfig: configWithAllNotificationTypesDisabled,
    };
    expect(result).toEqual(expected);
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
