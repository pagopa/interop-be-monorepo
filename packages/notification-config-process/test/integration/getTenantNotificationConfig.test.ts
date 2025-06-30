import { z } from "zod";
import { generateMock } from "@anatine/zod-mock";
import { getMockContext, getMockAuthData } from "pagopa-interop-commons-test";
import {
  generateId,
  TenantId,
  TenantNotificationConfig,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import {
  addOneTenantNotificationConfig,
  notificationConfigService,
} from "../integrationUtils.js";
import { tenantNotificationConfigNotFound } from "../../src/model/domain/errors.js";

describe("getTenantNotificationConfig", () => {
  const tenantId: TenantId = generateId();
  const tenantNotificationConfig: TenantNotificationConfig = {
    id: generateId(),
    tenantId,
    config: {
      newEServiceVersionPublished: true,
    },
    createdAt: generateMock(z.coerce.date()),
    updatedAt: generateMock(z.coerce.date().optional()),
  };

  it("should get the tenant's notification config", async () => {
    await addOneTenantNotificationConfig(tenantNotificationConfig);
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
