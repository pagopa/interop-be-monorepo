import { z } from "zod";
import { generateMock } from "@anatine/zod-mock";
import {
  getMockContext,
  getMockAuthData,
  decodeProtobufPayload,
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
  const userNotificationConfigSeed: notificationConfigApi.UserNotificationConfigSeed =
    {
      inAppConfig: { newEServiceVersionPublished: true },
      emailConfig: { newEServiceVersionPublished: false },
    };

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  it("should write on event-store for the first creation of a user's notification configuration", async () => {
    const { id } = await notificationConfigService.updateUserNotificationConfig(
      userNotificationConfigSeed,
      getMockContext({
        authData: getMockAuthData(tenantId, userId),
      })
    );
    const writtenEvent = await readLastNotificationConfigEvent(id);
    expect(writtenEvent.stream_id).toBe(id);
    expect(writtenEvent.version).toBe("0");
    expect(writtenEvent.type).toBe("UserNotificationConfigUpdated");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: UserNotificationConfigUpdatedV2,
      payload: writtenEvent.data,
    });
    const expectedUserNotificationConfig = toUserNotificationConfigV2({
      id,
      userId,
      tenantId,
      ...userNotificationConfigSeed,
      createdAt: new Date(),
    });
    expect(writtenPayload.userNotificationConfig).toEqual(
      expectedUserNotificationConfig
    );
  });

  it("should write on event-store for the update of a user's existing notification configuration", async () => {
    const userNotificationConfig: UserNotificationConfig = {
      id: generateId(),
      userId,
      tenantId,
      inAppConfig: { newEServiceVersionPublished: false },
      emailConfig: { newEServiceVersionPublished: false },
      createdAt: generateMock(z.coerce.date()),
      updatedAt: generateMock(z.coerce.date().optional()),
    };
    addOneUserNotificationConfig(userNotificationConfig);
    const { id } = await notificationConfigService.updateUserNotificationConfig(
      userNotificationConfigSeed,
      getMockContext({
        authData: getMockAuthData(tenantId, userId),
      })
    );
    const writtenEvent = await readLastNotificationConfigEvent(id);
    expect(writtenEvent.stream_id).toBe(id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("UserNotificationConfigUpdated");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: UserNotificationConfigUpdatedV2,
      payload: writtenEvent.data,
    });
    const expectedUserNotificationConfig = toUserNotificationConfigV2({
      id,
      userId,
      tenantId,
      ...userNotificationConfigSeed,
      createdAt: userNotificationConfig.createdAt,
      updatedAt: new Date(),
    });
    expect(writtenPayload.userNotificationConfig).toEqual(
      expectedUserNotificationConfig
    );
  });
});
