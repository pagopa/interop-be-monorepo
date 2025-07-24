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
} from "pagopa-interop-models";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  addOneUserNotificationConfig,
  notificationConfigService,
  readLastNotificationConfigEvent,
} from "../integrationUtils.js";
import { userNotificationConfigNotFound } from "../../src/model/domain/errors.js";

describe("deleteUserNotificationConfig", () => {
  const userId: UserId = generateId();
  const tenantId: TenantId = generateId();
  const userNotificationConfig: UserNotificationConfig = {
    ...getMockUserNotificationConfig(),
    userId,
    tenantId,
  };

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
    await addOneUserNotificationConfig(userNotificationConfig);
    // Extra config to check that the correct one is deleted
    await addOneUserNotificationConfig(getMockUserNotificationConfig());
  });

  it("should write on event-store for the deletion of a user's notification configuration", async () => {
    await notificationConfigService.deleteUserNotificationConfig(
      userId,
      tenantId,
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
        notificationConfigService.deleteUserNotificationConfig(
          userId,
          tenantId,
          getMockContextInternal({})
        )
      ).rejects.toThrowError(userNotificationConfigNotFound(userId, tenantId));
    }
  );
});
