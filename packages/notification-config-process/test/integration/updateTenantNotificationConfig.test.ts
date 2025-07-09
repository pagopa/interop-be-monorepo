import {
  getMockContext,
  getMockAuthData,
  decodeProtobufPayload,
  getMockNotificationConfig,
  getMockTenantNotificationConfig,
} from "pagopa-interop-commons-test";
import { notificationConfigApi } from "pagopa-interop-api-clients";
import {
  generateId,
  TenantId,
  TenantNotificationConfig,
  TenantNotificationConfigUpdatedV2,
  toTenantNotificationConfigV2,
} from "pagopa-interop-models";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  addOneTenantNotificationConfig,
  notificationConfigService,
  readLastNotificationConfigEvent,
} from "../integrationUtils.js";

describe("updateTenantNotificationConfig", () => {
  const tenantId: TenantId = generateId();

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
    // Extra config to check that the correct one is updated
    await addOneTenantNotificationConfig(getMockTenantNotificationConfig());
  });

  it("should write on event-store for the first creation of a tenant's notification configuration", async () => {
    const notificationConfigSeed: notificationConfigApi.NotificationConfigSeed =
      getMockNotificationConfig();
    const serviceReturnValue =
      await notificationConfigService.updateTenantNotificationConfig(
        notificationConfigSeed,
        getMockContext({
          authData: getMockAuthData(tenantId),
        })
      );
    const writtenEvent = await readLastNotificationConfigEvent(
      serviceReturnValue.id
    );
    expect(writtenEvent.stream_id).toBe(serviceReturnValue.id);
    expect(writtenEvent.version).toBe("0");
    expect(writtenEvent.type).toBe("TenantNotificationConfigUpdated");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: TenantNotificationConfigUpdatedV2,
      payload: writtenEvent.data,
    });
    const expectedTenantNotificationConfig = {
      id: serviceReturnValue.id,
      tenantId,
      config: notificationConfigSeed,
      createdAt: new Date(),
    };
    expect(serviceReturnValue).toEqual(expectedTenantNotificationConfig);
    expect(writtenPayload.tenantNotificationConfig).toEqual(
      toTenantNotificationConfigV2(expectedTenantNotificationConfig)
    );
  });

  it("should write on event-store for the update of a tenant's existing notification configuration", async () => {
    const tenantNotificationConfig: TenantNotificationConfig = {
      ...getMockTenantNotificationConfig(),
      tenantId,
    };
    addOneTenantNotificationConfig(tenantNotificationConfig);
    const notificationConfigSeed: notificationConfigApi.NotificationConfigSeed =
      {
        newEServiceVersionPublished:
          !tenantNotificationConfig.config.newEServiceVersionPublished,
      };
    const serviceReturnValue =
      await notificationConfigService.updateTenantNotificationConfig(
        notificationConfigSeed,
        getMockContext({
          authData: getMockAuthData(tenantId),
        })
      );
    const writtenEvent = await readLastNotificationConfigEvent(
      serviceReturnValue.id
    );
    expect(writtenEvent.stream_id).toBe(serviceReturnValue.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("TenantNotificationConfigUpdated");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: TenantNotificationConfigUpdatedV2,
      payload: writtenEvent.data,
    });
    const expectedTenantNotificationConfig = {
      id: serviceReturnValue.id,
      tenantId,
      config: notificationConfigSeed,
      createdAt: tenantNotificationConfig.createdAt,
      updatedAt: new Date(),
    };
    expect(serviceReturnValue).toEqual(expectedTenantNotificationConfig);
    expect(writtenPayload.tenantNotificationConfig).toEqual(
      toTenantNotificationConfigV2(expectedTenantNotificationConfig)
    );
  });
});
