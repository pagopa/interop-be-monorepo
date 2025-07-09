import {
  getMockContext,
  getMockAuthData,
  decodeProtobufPayload,
  getMockNotificationConfig,
  getMockUserNotificationConfig,
} from "pagopa-interop-commons-test";
import { notificationConfigApi } from "pagopa-interop-api-clients";
import {
  generateId,
  TenantId,
  UserId,
  UserNotificationConfig,
  UserNotificationConfigUpdatedV2,
  toUserNotificationConfigV2,
} from "pagopa-interop-models";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  addOneUserNotificationConfig,
  notificationConfigService,
  readLastNotificationConfigEvent,
} from "../integrationUtils.js";

describe("updateUserNotificationConfig", () => {
  const userId: UserId = generateId();
  const tenantId: TenantId = generateId();

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
    // Extra config to check that the correct one is updated
    await addOneUserNotificationConfig(getMockUserNotificationConfig());
  });

  it("should write on event-store for the first creation of a user's notification configuration", async () => {
    const userNotificationConfigSeed: notificationConfigApi.UserNotificationConfigSeed =
      {
        inAppConfig: getMockNotificationConfig(),
        emailConfig: getMockNotificationConfig(),
      };
    const serviceReturnValue =
      await notificationConfigService.updateUserNotificationConfig(
        userNotificationConfigSeed,
        getMockContext({
          authData: getMockAuthData(tenantId, userId),
        })
      );
    const writtenEvent = await readLastNotificationConfigEvent(
      serviceReturnValue.id
    );
    expect(writtenEvent.stream_id).toBe(serviceReturnValue.id);
    expect(writtenEvent.version).toBe("0");
    expect(writtenEvent.type).toBe("UserNotificationConfigUpdated");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: UserNotificationConfigUpdatedV2,
      payload: writtenEvent.data,
    });
    const expectedUserNotificationConfig = {
      id: serviceReturnValue.id,
      userId,
      tenantId,
      ...userNotificationConfigSeed,
      createdAt: new Date(),
    };
    expect(serviceReturnValue).toEqual(expectedUserNotificationConfig);
    expect(writtenPayload.userNotificationConfig).toEqual(
      toUserNotificationConfigV2(expectedUserNotificationConfig)
    );
  });

  it("should write on event-store for the update of a user's existing notification configuration", async () => {
    const userNotificationConfig: UserNotificationConfig = {
      ...getMockUserNotificationConfig(),
      userId,
      tenantId,
    };
    addOneUserNotificationConfig(userNotificationConfig);
    const userNotificationConfigSeed: notificationConfigApi.UserNotificationConfigSeed =
      {
        inAppConfig: {
          newEServiceVersionPublished:
            !userNotificationConfig.inAppConfig.newEServiceVersionPublished,
        },
        emailConfig: getMockNotificationConfig(),
      };
    const serviceReturnValue =
      await notificationConfigService.updateUserNotificationConfig(
        userNotificationConfigSeed,
        getMockContext({
          authData: getMockAuthData(tenantId, userId),
        })
      );
    const writtenEvent = await readLastNotificationConfigEvent(
      serviceReturnValue.id
    );
    expect(writtenEvent.stream_id).toBe(serviceReturnValue.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("UserNotificationConfigUpdated");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: UserNotificationConfigUpdatedV2,
      payload: writtenEvent.data,
    });
    const expectedUserNotificationConfig = {
      id: serviceReturnValue.id,
      userId,
      tenantId,
      ...userNotificationConfigSeed,
      createdAt: userNotificationConfig.createdAt,
      updatedAt: new Date(),
    };
    expect(serviceReturnValue).toEqual(expectedUserNotificationConfig);
    expect(writtenPayload.userNotificationConfig).toEqual(
      toUserNotificationConfigV2(expectedUserNotificationConfig)
    );
  });
});
