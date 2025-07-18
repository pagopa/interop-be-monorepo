import { z } from "zod";
import { generateMock } from "@anatine/zod-mock";
import { describe, expect, it } from "vitest";
import {
  NotificationConfigEventEnvelope,
  TenantNotificationConfig,
  TenantNotificationConfigUpdatedV2,
  UserNotificationConfig,
  UserNotificationConfigUpdatedV2,
  generateId,
  toTenantNotificationConfigV2,
  toUserNotificationConfigV2,
} from "pagopa-interop-models";
import { handleMessageV2 } from "../src/consumerServiceV2.js";
import {
  notificationConfigReadModelService,
  notificationConfigReadModelWriteService,
} from "./utils.js";

describe("database test", async () => {
  describe("Events V2", async () => {
    it("TenantNotificationConfigUpdated", async () => {
      const tenantNotificationConfig: TenantNotificationConfig = {
        id: generateId(),
        tenantId: generateId(),
        config: { newEServiceVersionPublished: false },
        createdAt: generateMock(z.coerce.date()),
        updatedAt: generateMock(z.coerce.date().optional()),
      };
      await notificationConfigReadModelWriteService.upsertTenantNotificationConfig(
        tenantNotificationConfig,
        1
      );

      const updatedTenantNotificationConfig: TenantNotificationConfig = {
        ...tenantNotificationConfig,
        config: { newEServiceVersionPublished: true },
      };

      const payload: TenantNotificationConfigUpdatedV2 = {
        tenantNotificationConfig: toTenantNotificationConfigV2(
          updatedTenantNotificationConfig
        ),
      };

      const message: NotificationConfigEventEnvelope = {
        sequence_num: 1,
        stream_id: tenantNotificationConfig.id,
        version: 2,
        type: "TenantNotificationConfigUpdated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, notificationConfigReadModelWriteService);

      const retrievedConfig =
        await notificationConfigReadModelService.getTenantNotificationConfigByTenantId(
          tenantNotificationConfig.tenantId
        );

      expect(retrievedConfig).toStrictEqual({
        data: updatedTenantNotificationConfig,
        metadata: { version: 2 },
      });
    });

    it("UserNotificationConfigUpdated", async () => {
      const userNotificationConfig: UserNotificationConfig = {
        id: generateId(),
        userId: generateId(),
        tenantId: generateId(),
        inAppConfig: { newEServiceVersionPublished: false },
        emailConfig: { newEServiceVersionPublished: true },
        createdAt: generateMock(z.coerce.date()),
        updatedAt: generateMock(z.coerce.date().optional()),
      };
      await notificationConfigReadModelWriteService.upsertUserNotificationConfig(
        userNotificationConfig,
        1
      );

      const updatedUserNotificationConfig: UserNotificationConfig = {
        ...userNotificationConfig,
        inAppConfig: { newEServiceVersionPublished: true },
        emailConfig: { newEServiceVersionPublished: false },
      };

      const payload: UserNotificationConfigUpdatedV2 = {
        userNotificationConfig: toUserNotificationConfigV2(
          updatedUserNotificationConfig
        ),
      };

      const message: NotificationConfigEventEnvelope = {
        sequence_num: 1,
        stream_id: userNotificationConfig.id,
        version: 2,
        type: "UserNotificationConfigUpdated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, notificationConfigReadModelWriteService);

      const retrievedConfig =
        await notificationConfigReadModelService.getUserNotificationConfigByUserIdAndTenantId(
          userNotificationConfig.userId,
          userNotificationConfig.tenantId
        );

      expect(retrievedConfig).toStrictEqual({
        data: updatedUserNotificationConfig,
        metadata: { version: 2 },
      });
    });
  });
});
