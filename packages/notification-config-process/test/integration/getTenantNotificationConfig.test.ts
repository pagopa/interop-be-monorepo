import {
  getMockContext,
  getMockAuthData,
  getMockTenantNotificationConfig,
} from "pagopa-interop-commons-test";
import {
  generateId,
  TenantId,
  TenantNotificationConfig,
} from "pagopa-interop-models";
import { beforeAll, describe, expect, it } from "vitest";
import {
  addOneTenantNotificationConfig,
  notificationConfigService,
} from "../integrationUtils.js";
import { tenantNotificationConfigNotFound } from "../../src/model/domain/errors.js";

describe("getTenantNotificationConfig", () => {
  const tenantId: TenantId = generateId();
  const tenantNotificationConfig: TenantNotificationConfig = {
    ...getMockTenantNotificationConfig(),
    tenantId,
  };

  beforeAll(async () => {
    await addOneTenantNotificationConfig(tenantNotificationConfig);
    // Extra config to check that the correct one is returned
    await addOneTenantNotificationConfig(getMockTenantNotificationConfig());
  });

  it("should get the tenant's notification config", async () => {
    const result = await notificationConfigService.getTenantNotificationConfig(
      getMockContext({
        authData: getMockAuthData(tenantId),
      })
    );
    expect(result).toEqual(tenantNotificationConfig);
  });

  it("should throw tenantNotificationConfigNotFound if no notification config exists for the tenant", async () => {
    const notExistingTenantId: TenantId = generateId();
    expect(
      notificationConfigService.getTenantNotificationConfig(
        getMockContext({
          authData: getMockAuthData(notExistingTenantId),
        })
      )
    ).rejects.toThrowError(
      tenantNotificationConfigNotFound(notExistingTenantId)
    );
  });
});
