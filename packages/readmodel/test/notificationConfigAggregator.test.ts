/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { describe, expect, it } from "vitest";
import { generateMock } from "@anatine/zod-mock";
import {
  TenantNotificationConfig,
  UserNotificationConfig,
} from "pagopa-interop-models";
import {
  aggregateTenantNotificationConfig,
  aggregateUserNotificationConfig,
} from "../src/notification-config/aggregators.js";
import {
  splitTenantNotificationConfigIntoObjectsSQL,
  splitUserNotificationConfigIntoObjectsSQL,
} from "../src/notification-config/splitters.js";

describe("Notification config aggregators", () => {
  it("should convert a TenantNotificationConfig SQL object into a TenantNotificationConfig", () => {
    const tenantNotificationConfig = generateMock(TenantNotificationConfig);
    const tenantNotificationConfigSQL =
      splitTenantNotificationConfigIntoObjectsSQL(tenantNotificationConfig, 1);

    const aggregatedTenantNotificationConfig =
      aggregateTenantNotificationConfig(tenantNotificationConfigSQL);
    expect(aggregatedTenantNotificationConfig).toStrictEqual({
      data: tenantNotificationConfig,
      metadata: { version: 1 },
    });
  });

  it("should convert a UserNotificationConfig SQL object into a UserNotificationConfig", () => {
    const userNotificationConfig = generateMock(UserNotificationConfig);
    const userNotificationConfigSQL = splitUserNotificationConfigIntoObjectsSQL(
      userNotificationConfig,
      1
    );

    const aggregatedUserNotificationConfig = aggregateUserNotificationConfig(
      userNotificationConfigSQL
    );
    expect(aggregatedUserNotificationConfig).toStrictEqual({
      data: userNotificationConfig,
      metadata: { version: 1 },
    });
  });
});
