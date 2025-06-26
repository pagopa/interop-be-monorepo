import {
  getMockContext,
  getMockAuthData,
  decodeProtobufPayload,
} from "pagopa-interop-commons-test";
import { notificationConfigApi } from "pagopa-interop-api-clients";
import {
  generateId,
  TenantId,
  TenantNotificationConfig,
  TenantNotificationConfigUpdatedV2,
  toTenantNotificationConfigV2,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import {
  addOneTenantNotificationConfig,
  notificationConfigService,
  readLastNotificationConfigEvent,
} from "../integrationUtils.js";

describe("updateTenantNotificationConfig", () => {
  const tenantId: TenantId = generateId();
  const notificationConfigSeed: notificationConfigApi.NotificationConfigSeed = {
    newEServiceVersionPublished: true,
  };

  it("should write on event-store for the first creation of a tenant's notification configuration", async () => {
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
    });
    expect(writtenPayload.tenantNotificationConfig).toEqual(
      expectedTenantNotificationConfig
    );
  });

  it("should write on event-store for the update of a tenant's existing notification configuration", async () => {
    const tenantNotificationConfig: TenantNotificationConfig = {
      id: generateId(),
      tenantId,
      config: { newEServiceVersionPublished: false },
    };
    addOneTenantNotificationConfig(tenantNotificationConfig);
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
    });
    expect(writtenPayload.tenantNotificationConfig).toEqual(
      expectedTenantNotificationConfig
    );
  });
});
