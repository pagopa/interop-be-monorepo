/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { describe, expect, it } from "vitest";
import { z } from "zod";
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
  describe("splitTenantNotificationConfigIntoObjectsSQL", () => {
    it("should convert a TenantNotificationConfig into a TenantNotificationConfig SQL object", () => {
      const tenantNotificationConfig = {
        ...generateMock(TenantNotificationConfig),
        updatedAt: generateMock(z.coerce.date()), // Ensure updatedAt is not undefined
      };
      const tenantNotificationConfigSQL =
        splitTenantNotificationConfigIntoObjectsSQL(
          tenantNotificationConfig,
          1
        );

      const expectedTenantNotificationConfigSQL: TenantNotificationConfigSQL = {
        id: tenantNotificationConfig.id,
        tenantId: tenantNotificationConfig.tenantId,
        metadataVersion: 1,
        createdAt: tenantNotificationConfig.createdAt.toISOString(),
        updatedAt: tenantNotificationConfig.updatedAt.toISOString(),
        newEserviceVersionPublished:
          tenantNotificationConfig.config.newEServiceVersionPublished,
      };

      expect(tenantNotificationConfigSQL).toStrictEqual(
        expectedTenantNotificationConfigSQL
      );
    });

    it("should convert undefined into null", () => {
      const tenantNotificationConfig = {
        ...generateMock(TenantNotificationConfig),
        updatedAt: undefined,
      };
      const tenantNotificationConfigSQL =
        splitTenantNotificationConfigIntoObjectsSQL(
          tenantNotificationConfig,
          1
        );

      const expectedTenantNotificationConfigSQL: TenantNotificationConfigSQL = {
        id: tenantNotificationConfig.id,
        tenantId: tenantNotificationConfig.tenantId,
        metadataVersion: 1,
        createdAt: tenantNotificationConfig.createdAt.toISOString(),
        updatedAt: null,
        newEserviceVersionPublished:
          tenantNotificationConfig.config.newEServiceVersionPublished,
      };

      expect(tenantNotificationConfigSQL).toStrictEqual(
        expectedTenantNotificationConfigSQL
      );
    });
  });

  describe("splitUserNotificationConfigIntoObjectsSQL", () => {
    it("should convert a UserNotificationConfig into a UserNotificationConfig SQL object", () => {
      const userNotificationConfig = {
        ...generateMock(UserNotificationConfig),
        updatedAt: generateMock(z.coerce.date()), // Ensure updatedAt is not undefined
      };
      const userNotificationConfigSQL =
        splitUserNotificationConfigIntoObjectsSQL(userNotificationConfig, 1);

      const expectedUserNotificationConfigSQL: UserNotificationConfigSQL = {
        id: userNotificationConfig.id,
        userId: userNotificationConfig.userId,
        tenantId: userNotificationConfig.tenantId,
        metadataVersion: 1,
        createdAt: userNotificationConfig.createdAt.toISOString(),
        updatedAt: userNotificationConfig.updatedAt.toISOString(),
        newEserviceVersionPublishedInApp:
          userNotificationConfig.inAppConfig.newEServiceVersionPublished,
        newEserviceVersionPublishedEmail:
          userNotificationConfig.emailConfig.newEServiceVersionPublished,
      };

      expect(userNotificationConfigSQL).toStrictEqual(
        expectedUserNotificationConfigSQL
      );
    });

    it("should convert undefined into null", () => {
      const userNotificationConfig = {
        ...generateMock(UserNotificationConfig),
        updatedAt: undefined,
      };
      const userNotificationConfigSQL =
        splitUserNotificationConfigIntoObjectsSQL(userNotificationConfig, 1);

      const expectedUserNotificationConfigSQL: UserNotificationConfigSQL = {
        id: userNotificationConfig.id,
        userId: userNotificationConfig.userId,
        tenantId: userNotificationConfig.tenantId,
        metadataVersion: 1,
        createdAt: userNotificationConfig.createdAt.toISOString(),
        updatedAt: null,
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
});
