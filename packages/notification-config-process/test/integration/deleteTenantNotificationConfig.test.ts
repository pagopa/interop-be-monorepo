import {
  decodeProtobufPayload,
  getMockTenantNotificationConfig,
  getMockContextInternal,
} from "pagopa-interop-commons-test";
import {
  generateId,
  TenantId,
  TenantNotificationConfig,
  TenantNotificationConfigDeletedV2,
  toTenantNotificationConfigV2,
} from "pagopa-interop-models";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  addOneTenantNotificationConfig,
  notificationConfigService,
  readLastNotificationConfigEvent,
} from "../integrationUtils.js";
import { tenantNotificationConfigNotFound } from "../../src/model/domain/errors.js";

describe("deleteTenantNotificationConfig", () => {
  const tenantId: TenantId = generateId();
  const tenantNotificationConfig: TenantNotificationConfig = {
    ...getMockTenantNotificationConfig(),
    tenantId,
  };

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
    await addOneTenantNotificationConfig(tenantNotificationConfig);
    // Extra config to check that the correct one is deleted
    await addOneTenantNotificationConfig(getMockTenantNotificationConfig());
  });

  it("should write on event-store for the deletion of a tenant's notification configuration", async () => {
    await notificationConfigService.deleteTenantNotificationConfig(
      tenantId,
      getMockContextInternal({})
    );
    const writtenEvent = await readLastNotificationConfigEvent(
      tenantNotificationConfig.id
    );
    expect(writtenEvent.stream_id).toBe(tenantNotificationConfig.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("TenantNotificationConfigDeleted");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: TenantNotificationConfigDeletedV2,
      payload: writtenEvent.data,
    });
    expect(writtenPayload.tenantNotificationConfig).toEqual(
      toTenantNotificationConfigV2(tenantNotificationConfig)
    );
  });

  it("should throw tenantNotificationConfigNotFound if no notification config exists for the tenant", async () => {
    const notExistingTenantId: TenantId = generateId();
    expect(
      notificationConfigService.deleteTenantNotificationConfig(
        notExistingTenantId,
        getMockContextInternal({})
      )
    ).rejects.toThrowError(
      tenantNotificationConfigNotFound(notExistingTenantId)
    );
  });
});
