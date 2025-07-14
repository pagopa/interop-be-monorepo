import {
  decodeProtobufPayload,
  getMockNotificationConfig,
  getMockUserNotificationConfig,
  getMockContextInternal,
} from "pagopa-interop-commons-test";
import { notificationConfigApi } from "pagopa-interop-api-clients";
import {
  generateId,
  UserId,
  UserNotificationConfig,
  UserNotificationConfigCreatedV2,
  toUserNotificationConfigV2,
  TenantId,
} from "pagopa-interop-models";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  addOneUserNotificationConfig,
  notificationConfigService,
  readLastNotificationConfigEvent,
} from "../integrationUtils.js";
import { userNotificationConfigAlreadyExists } from "../../src/model/domain/errors.js";

describe("createUserNotificationConfig", () => {
  const userId: UserId = generateId();
  const tenantId: TenantId = generateId();

  const userNotificationConfigSeed: notificationConfigApi.UserNotificationConfigSeed =
    {
      inAppConfig: getMockNotificationConfig(),
      emailConfig: getMockNotificationConfig(),
    };

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  it("should write on event-store for the creation of a user's notification configuration", async () => {
    const serviceReturnValue =
      await notificationConfigService.createUserNotificationConfig(
        userId,
        tenantId,
        userNotificationConfigSeed,
        getMockContextInternal({})
      );
    const writtenEvent = await readLastNotificationConfigEvent(
      serviceReturnValue.id
    );
    expect(writtenEvent.stream_id).toBe(serviceReturnValue.id);
    expect(writtenEvent.version).toBe("0");
    expect(writtenEvent.type).toBe("UserNotificationConfigCreated");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: UserNotificationConfigCreatedV2,
      payload: writtenEvent.data,
    });
    const expectedUserNotificationConfig: UserNotificationConfig = {
      id: serviceReturnValue.id,
      userId,
      tenantId,
      inAppConfig: userNotificationConfigSeed.inAppConfig,
      emailConfig: userNotificationConfigSeed.emailConfig,
      createdAt: new Date(),
    };
    expect(serviceReturnValue).toEqual(expectedUserNotificationConfig);
    expect(writtenPayload.userNotificationConfig).toEqual(
      toUserNotificationConfigV2(expectedUserNotificationConfig)
    );
  });

  it("should throw userNotificationConfigAlreadyExists if a notification config already exists for that user", async () => {
    const userNotificationConfig: UserNotificationConfig = {
      ...getMockUserNotificationConfig(),
      userId,
      tenantId,
    };
    addOneUserNotificationConfig(userNotificationConfig);
    expect(
      notificationConfigService.createUserNotificationConfig(
        userId,
        tenantId,
        userNotificationConfigSeed,
        getMockContextInternal({})
      )
    ).rejects.toThrowError(
      userNotificationConfigAlreadyExists(userId, tenantId)
    );
  });
});
