/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { generateMock } from "@anatine/zod-mock";
import {
  getMockTenantNotificationConfig,
  getMockUserNotificationConfig,
} from "pagopa-interop-commons-test";
import {
  aggregateTenantNotificationConfig,
  aggregateUserNotificationConfig,
} from "../../src/notification-config/aggregators.js";
import {
  splitTenantNotificationConfigIntoObjectsSQL,
  splitUserNotificationConfigIntoObjectsSQL,
} from "../../src/notification-config/splitters.js";

describe("Notification config aggregators", () => {
  describe("aggregateTenantNotificationConfig", () => {
    it("should convert a complete TenantNotificationConfig SQL object into a TenantNotificationConfig", () => {
      const tenantNotificationConfig = {
        ...getMockTenantNotificationConfig(),
        updatedAt: generateMock(z.coerce.date()), // Ensure updatedAt is not undefined
      };
      const tenantNotificationConfigItemsSQL =
        splitTenantNotificationConfigIntoObjectsSQL(
          tenantNotificationConfig,
          1
        );

      const aggregatedTenantNotificationConfig =
        aggregateTenantNotificationConfig(tenantNotificationConfigItemsSQL);
      expect(aggregatedTenantNotificationConfig).toStrictEqual({
        data: tenantNotificationConfig,
        metadata: { version: 1 },
      });
    });

    it("should convert TenantNotificationConfig SQL objects with null updatedAt into a TenantNotificationConfig without an updatedAt prop", () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { updatedAt: _, ...tenantNotificationConfig } =
        getMockTenantNotificationConfig();
      const tenantNotificationConfigSQL =
        splitTenantNotificationConfigIntoObjectsSQL(
          tenantNotificationConfig,
          1
        );
      expect(tenantNotificationConfigSQL.updatedAt).toBeNull();

      const aggregatedTenantNotificationConfig =
        aggregateTenantNotificationConfig(tenantNotificationConfigSQL);
      expect(aggregatedTenantNotificationConfig).toStrictEqual({
        data: tenantNotificationConfig,
        metadata: { version: 1 },
      });
    });
  });

  describe("aggregateUserNotificationConfig", () => {
    it("should convert a complete UserNotificationConfig SQL object into a UserNotificationConfig", () => {
      const userNotificationConfig = {
        ...getMockUserNotificationConfig(),
        updatedAt: generateMock(z.coerce.date()), // Ensure updatedAt is not undefined
      };
      const userNotificationConfigItemsSQL =
        splitUserNotificationConfigIntoObjectsSQL(userNotificationConfig, 1);

      const aggregatedUserNotificationConfig = aggregateUserNotificationConfig(
        userNotificationConfigItemsSQL
      );
      expect(aggregatedUserNotificationConfig).toStrictEqual({
        data: userNotificationConfig,
        metadata: { version: 1 },
      });
    });

    it("should convert UserNotificationConfig SQL objects with null updatedAt into a UserNotificationConfig without an updatedAt prop", () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { updatedAt: _, ...userNotificationConfig } =
        getMockUserNotificationConfig();
      const userNotificationConfigItemsSQL =
        splitUserNotificationConfigIntoObjectsSQL(userNotificationConfig, 1);
      expect(
        userNotificationConfigItemsSQL.userNotificationConfigSQL.updatedAt
      ).toBeNull();

      const aggregatedUserNotificationConfig = aggregateUserNotificationConfig(
        userNotificationConfigItemsSQL
      );
      expect(aggregatedUserNotificationConfig).toStrictEqual({
        data: userNotificationConfig,
        metadata: { version: 1 },
      });
    });
  });
});
