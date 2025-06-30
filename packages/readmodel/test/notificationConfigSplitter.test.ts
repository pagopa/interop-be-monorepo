/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { describe, expect, it } from "vitest";
import { generateMock } from "@anatine/zod-mock";
import {
  TenantNotificationConfig,
  UserNotificationConfig,
} from "pagopa-interop-models";
import {
  TenantNotificationConfigSQL,
  UserNotificationConfigSQL,
} from "pagopa-interop-readmodel-models";
import {
  splitTenantNotificationConfigIntoObjectsSQL,
  splitUserNotificationConfigIntoObjectsSQL,
} from "../src/notification-config/splitters.js";

describe("Notification config splitters", () => {
  it("should convert a TenantNotificationConfig into a TenantNotificationConfig SQL object", () => {
    const tenantNotificationConfig = generateMock(TenantNotificationConfig);
    const tenantNotificationConfigSQL =
      splitTenantNotificationConfigIntoObjectsSQL(tenantNotificationConfig, 1);

    const expectedTenantNotificationConfigSQL: TenantNotificationConfigSQL = {
      id: tenantNotificationConfig.id,
      tenantId: tenantNotificationConfig.tenantId,
      metadataVersion: 1,
      newEserviceVersionPublished:
        tenantNotificationConfig.config.newEServiceVersionPublished,
    };

    expect(tenantNotificationConfigSQL).toStrictEqual(
      expectedTenantNotificationConfigSQL
    );
  });

  it("should convert a UserNotificationConfig into a UserNotificationConfig SQL object", () => {
    const userNotificationConfig = generateMock(UserNotificationConfig);
    const userNotificationConfigSQL = splitUserNotificationConfigIntoObjectsSQL(
      userNotificationConfig,
      1
    );

    const expectedUserNotificationConfigSQL: UserNotificationConfigSQL = {
      id: userNotificationConfig.id,
      userId: userNotificationConfig.userId,
      tenantId: userNotificationConfig.tenantId,
      metadataVersion: 1,
      newEserviceVersionPublishedInApp:
        userNotificationConfig.inAppConfig.newEServiceVersionPublished,
      newEserviceVersionPublishedEmail:
        userNotificationConfig.emailConfig.newEServiceVersionPublished,
    };

    expect(userNotificationConfigSQL).toStrictEqual(
      expectedUserNotificationConfigSQL
    );
  });
});
