import {
  decodeProtobufPayload,
  getMockUserNotificationConfig,
  getMockContextInternal,
} from "pagopa-interop-commons-test";
import {
  generateId,
  TenantId,
  UserNotificationConfig,
  UserNotificationConfigDeletedV2,
  toUserNotificationConfigV2,
  UserId,
  userRole,
  UserNotificationConfigRoleRemovedV2,
} from "pagopa-interop-models";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addOneUserNotificationConfig,
  notificationConfigService,
  readLastNotificationConfigEvent,
} from "../integrationUtils.js";
import {
  userNotificationConfigNotFound,
  userRoleNotInUserNotificationConfig,
} from "../../src/model/domain/errors.js";

describe("removeUserNotificationConfigRole", () => {
  const userId: UserId = generateId();
  const tenantId: TenantId = generateId();
  const anotherTenantId: TenantId = generateId();
  const userNotificationConfig: UserNotificationConfig = {
    ...getMockUserNotificationConfig(),
    userId,
    tenantId,
    userRoles: [userRole.ADMIN_ROLE],
  };
  const userNotificationConfigWithTwoRoles: UserNotificationConfig = {
    ...getMockUserNotificationConfig(),
    userId,
    tenantId: anotherTenantId,
    userRoles: [userRole.API_ROLE, userRole.SECURITY_ROLE],
  };

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  beforeEach(async () => {
    await addOneUserNotificationConfig(userNotificationConfig);
    await addOneUserNotificationConfig(userNotificationConfigWithTwoRoles);
    // Extra config to check that the correct one is deleted
    await addOneUserNotificationConfig(getMockUserNotificationConfig());
  });

  it("should write on event-store for the deletion of a user's notification configuration when the last role is removed", async () => {
    await notificationConfigService.removeUserNotificationConfigRole(
      userId,
      tenantId,
      userRole.ADMIN_ROLE,
      getMockContextInternal({})
    );
    const writtenEvent = await readLastNotificationConfigEvent(
      userNotificationConfig.id
    );
    expect(writtenEvent.stream_id).toBe(userNotificationConfig.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("UserNotificationConfigDeleted");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: UserNotificationConfigDeletedV2,
      payload: writtenEvent.data,
    });
    expect(writtenPayload.userNotificationConfig).toEqual(
      toUserNotificationConfigV2(userNotificationConfig)
    );
  });

  it("should write on event-store for the removal of the role from the user's notification configuration when there are other roles", async () => {
    await notificationConfigService.removeUserNotificationConfigRole(
      userId,
      anotherTenantId,
      userRole.SECURITY_ROLE,
      getMockContextInternal({})
    );
    const writtenEvent = await readLastNotificationConfigEvent(
      userNotificationConfigWithTwoRoles.id
    );
    expect(writtenEvent.stream_id).toBe(userNotificationConfigWithTwoRoles.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("UserNotificationConfigRoleRemoved");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: UserNotificationConfigRoleRemovedV2,
      payload: writtenEvent.data,
    });
    expect(writtenPayload.userNotificationConfig).toEqual(
      toUserNotificationConfigV2({
        ...userNotificationConfigWithTwoRoles,
        userRoles: [userRole.API_ROLE],
        updatedAt: new Date(),
      })
    );
  });

  it.each<[string, UserId, TenantId]>([
    ["non-existent tenant id", userId, generateId<TenantId>()],
    ["non-existent user id", generateId<UserId>(), tenantId],
    [
      "non-existent user and tenant id's",
      generateId<UserId>(),
      generateId<TenantId>(),
    ],
  ])(
    "should throw userNotificationConfigNotFound in case of %s",
    async (_, userId, tenantId) => {
      expect(
        notificationConfigService.removeUserNotificationConfigRole(
          userId,
          tenantId,
          userRole.ADMIN_ROLE,
          getMockContextInternal({})
        )
      ).rejects.toThrowError(userNotificationConfigNotFound(userId, tenantId));
    }
  );

  it("should throw userRoleNotInUserNotificationConfig if role is not in user notification config", async () => {
    expect(
      notificationConfigService.removeUserNotificationConfigRole(
        userId,
        tenantId,
        userRole.API_ROLE,
        getMockContextInternal({})
      )
    ).rejects.toThrowError(
      userRoleNotInUserNotificationConfig(userId, tenantId, userRole.API_ROLE)
    );
  });
});
