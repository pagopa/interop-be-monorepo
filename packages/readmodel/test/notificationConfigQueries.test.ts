/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { describe, expect, it } from "vitest";
import { generateId } from "pagopa-interop-models";
import {
  getMockTenantNotificationConfig,
  getMockUserNotificationConfig,
} from "pagopa-interop-commons-test";
import {
  insertTenantNotificationConfig,
  insertUserNotificationConfig,
  notificationConfigReadModelService,
} from "./notificationConfigUtils.js";

describe("Notification config queries", () => {
  describe("getTenantNotificationConfigByTenantId", () => {
    it("should get a tenant notification config if present", async () => {
      const tenantNotificationConfig = getMockTenantNotificationConfig();
      await insertTenantNotificationConfig(tenantNotificationConfig, 1);

      const retrievedConfig =
        await notificationConfigReadModelService.getTenantNotificationConfigByTenantId(
          tenantNotificationConfig.tenantId
        );
      expect(retrievedConfig).toStrictEqual({
        data: tenantNotificationConfig,
        metadata: { version: 1 },
      });
    });

    it("should *not* get a tenant notification config if not present", async () => {
      const retrievedConfig =
        await notificationConfigReadModelService.getTenantNotificationConfigByTenantId(
          generateId()
        );
      expect(retrievedConfig).toBeUndefined();
    });
  });

  describe("getUserNotificationConfigByUserIdAndTenantId", () => {
    it("should get a user notification config if present", async () => {
      const userNotificationConfig = getMockUserNotificationConfig();
      await insertUserNotificationConfig(userNotificationConfig, 1);

      const retrievedConfig =
        await notificationConfigReadModelService.getUserNotificationConfigByUserIdAndTenantId(
          userNotificationConfig.userId,
          userNotificationConfig.tenantId
        );
      expect(retrievedConfig).toStrictEqual({
        data: userNotificationConfig,
        metadata: { version: 1 },
      });
    });

    it("should *not* get a user notification config if not present", async () => {
      const retrievedConfig =
        await notificationConfigReadModelService.getUserNotificationConfigByUserIdAndTenantId(
          generateId(),
          generateId()
        );
      expect(retrievedConfig).toBeUndefined();
    });
  });
});
