import { getMockContext, getMockAuthData } from "pagopa-interop-commons-test";
import { notificationConfigApi } from "pagopa-interop-api-clients";
import { generateId, TenantId } from "pagopa-interop-models";
import { describe, it } from "vitest";
import { notificationConfigService } from "../integrationUtils.js";

describe("update tenant notification configuration", () => {
  const tenantId: TenantId = generateId();
  const notificationConfigSeed: notificationConfigApi.NotificationConfigSeed = {
    consumer: { eService: { newEServiceVersionPublished: true } },
  };

  it("should write on event-store for the update of a tenant's notification configuration", async () => {
    await notificationConfigService.updateTenantNotificationConfig(
      notificationConfigSeed,
      getMockContext({
        authData: getMockAuthData(tenantId),
      })
    );
    // FIXME check the event written in the event store
  });
});
