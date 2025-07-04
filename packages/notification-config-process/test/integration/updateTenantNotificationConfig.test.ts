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

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  it("should write on event-store for the first creation of a tenant's notification configuration", async () => {
    const notificationConfigSeed: notificationConfigApi.NotificationConfigSeed =
      getMockNotificationConfig();
    const { id } =
      await notificationConfigService.updateTenantNotificationConfig(
        notificationConfigSeed,
        getMockContext({
          authData: getMockAuthData(tenantId),
        })
      );
    const writtenEvent = await readLastNotificationConfigEvent(id);
    expect(writtenEvent.stream_id).toBe(id);
    expect(writtenEvent.version).toBe("0");
    expect(writtenEvent.type).toBe("TenantNotificationConfigUpdated");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: TenantNotificationConfigUpdatedV2,
      payload: writtenEvent.data,
    });
    const expectedTenantNotificationConfig = toTenantNotificationConfigV2({
      id,
      tenantId,
      config: notificationConfigSeed,
      createdAt: new Date(),
    });
    expect(writtenPayload.tenantNotificationConfig).toEqual(
      expectedTenantNotificationConfig
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
    const { id } =
      await notificationConfigService.updateTenantNotificationConfig(
        notificationConfigSeed,
        getMockContext({
          authData: getMockAuthData(tenantId),
        })
      );
    const writtenEvent = await readLastNotificationConfigEvent(id);
    expect(writtenEvent.stream_id).toBe(id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("TenantNotificationConfigUpdated");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: TenantNotificationConfigUpdatedV2,
      payload: writtenEvent.data,
    });
    const expectedTenantNotificationConfig = toTenantNotificationConfigV2({
      id,
      tenantId,
      config: notificationConfigSeed,
      createdAt: tenantNotificationConfig.createdAt,
      updatedAt: new Date(),
    });
    expect(writtenPayload.tenantNotificationConfig).toEqual(
      expectedTenantNotificationConfig
    );
  });
});
