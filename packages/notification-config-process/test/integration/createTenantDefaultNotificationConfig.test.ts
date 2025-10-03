import {
  decodeProtobufPayload,
  getMockTenantNotificationConfig,
  getMockContextInternal,
} from "pagopa-interop-commons-test";
import {
  generateId,
  TenantId,
  TenantNotificationConfig,
  TenantNotificationConfigCreatedV2,
  toTenantNotificationConfigV2,
} from "pagopa-interop-models";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  addOneTenantNotificationConfig,
  notificationConfigService,
  readLastNotificationConfigEvent,
} from "../integrationUtils.js";
import { tenantNotificationConfigAlreadyExists } from "../../src/model/domain/errors.js";

describe("createTenantNotificationConfig", () => {
  const tenantId: TenantId = generateId();

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  it("should write on event-store for the creation of a tenant's notification configuration", async () => {
    const serviceReturnValue =
      await notificationConfigService.createTenantDefaultNotificationConfig(
        tenantId,
        getMockContextInternal({})
      );
    const writtenEvent = await readLastNotificationConfigEvent(
      serviceReturnValue.id
    );
    expect(writtenEvent.stream_id).toBe(serviceReturnValue.id);
    expect(writtenEvent.version).toBe("0");
    expect(writtenEvent.type).toBe("TenantNotificationConfigCreated");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: TenantNotificationConfigCreatedV2,
      payload: writtenEvent.data,
    });
    const expectedTenantNotificationConfig: TenantNotificationConfig = {
      id: serviceReturnValue.id,
      tenantId,
      enabled: true,
      createdAt: new Date(),
    };
    expect(serviceReturnValue).toEqual(expectedTenantNotificationConfig);
    expect(writtenPayload.tenantNotificationConfig).toEqual(
      toTenantNotificationConfigV2(expectedTenantNotificationConfig)
    );
  });

  it("should throw tenantNotificationConfigAlreadyExists if a notification config already exists for that tenant", async () => {
    const tenantNotificationConfig: TenantNotificationConfig = {
      ...getMockTenantNotificationConfig(),
      tenantId,
    };
    await addOneTenantNotificationConfig(tenantNotificationConfig);
    expect(
      notificationConfigService.createTenantDefaultNotificationConfig(
        tenantId,
        getMockContextInternal({})
      )
    ).rejects.toThrowError(tenantNotificationConfigAlreadyExists(tenantId));
  });
});
