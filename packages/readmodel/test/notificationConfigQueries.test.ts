/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { describe, expect, it } from "vitest";
import { generateMock } from "@anatine/zod-mock";
import { match } from "ts-pattern";
import {
  NotificationConfig,
  TenantId,
  UserNotificationConfig,
  generateId,
} from "pagopa-interop-models";
import {
  getMockTenantNotificationConfig,
  getMockUserNotificationConfig,
} from "pagopa-interop-commons-test";
import {
  insertTenantNotificationConfig,
  insertUserNotificationConfig,
} from "../src/testUtils.js";
import { notificationConfigReadModelService } from "./notificationConfigUtils.js";
import { readModelDB } from "./utils.js";

describe("Notification config queries", () => {
  describe("getTenantNotificationConfigByTenantId", () => {
    it("should get a tenant notification config if present", async () => {
      const tenantNotificationConfig = getMockTenantNotificationConfig();
      await insertTenantNotificationConfig(
        readModelDB,
        tenantNotificationConfig,
        1
      );

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
      await insertUserNotificationConfig(
        readModelDB,
        userNotificationConfig,
        1
      );

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

  describe("getTenantUsersWithNotificationEnabled", () => {
    const set =
      (
        notificationType: keyof NotificationConfig,
        notificationChannel: "inApp" | "email",
        enabled: boolean
      ) =>
      (config: UserNotificationConfig) =>
        match(notificationChannel)
          .with("inApp", () => ({
            ...config,
            inAppConfig: {
              ...config.inAppConfig,
              [notificationType]: enabled,
            },
          }))
          .with("email", () => ({
            ...config,
            emailConfig: {
              ...config.emailConfig,
              [notificationType]: enabled,
            },
          }))
          .exhaustive();

    it.each(["inApp", "email"] as const)(
      "should get all users of the tenant with the notification enabled (%s)",
      async (notificationChannel) => {
        const tenantId1 = generateId<TenantId>();
        const tenantId2 = generateId<TenantId>();
        const notificationType = generateMock(NotificationConfig.keyof());
        const setEnabled = set(notificationType, notificationChannel, true);
        const setDisabled = set(notificationType, notificationChannel, false);
        const userNotificationConfigs = [
          setEnabled({
            ...getMockUserNotificationConfig(),
            tenantId: tenantId1,
          }),
          setEnabled({ ...getMockUserNotificationConfig() }),
          setDisabled({
            ...getMockUserNotificationConfig(),
            tenantId: tenantId1,
          }),
          setEnabled({
            ...getMockUserNotificationConfig(),
            tenantId: tenantId1,
          }),
          setEnabled({
            ...getMockUserNotificationConfig(),
            tenantId: tenantId2,
          }),
        ];
        await Promise.all(
          userNotificationConfigs.map((userNotificationConfig) =>
            insertUserNotificationConfig(readModelDB, userNotificationConfig, 0)
          )
        );

        const retrievedUsers =
          await notificationConfigReadModelService.getTenantUsersWithNotificationEnabled(
            [tenantId1, tenantId2],
            notificationType,
            notificationChannel
          );
        expect(retrievedUsers).toHaveLength(3);
        expect(retrievedUsers).toEqual(
          expect.arrayContaining([
            { userId: userNotificationConfigs[0].userId, tenantId: tenantId1 },
            { userId: userNotificationConfigs[3].userId, tenantId: tenantId1 },
            { userId: userNotificationConfigs[4].userId, tenantId: tenantId2 },
          ])
        );
      }
    );

    it.each(["inApp", "email"] as const)(
      "should return an empty array if no users have the notification enabled (%s)",
      async (notificationChannel) => {
        const tenantId = generateId<TenantId>();
        const notificationType = generateMock(NotificationConfig.keyof());
        const setEnabled = set(notificationType, notificationChannel, true);
        const setDisabled = set(notificationType, notificationChannel, false);
        const userNotificationConfigs = [
          setDisabled({
            ...getMockUserNotificationConfig(),
            tenantId,
          }),
          setEnabled({ ...getMockUserNotificationConfig() }),
          setDisabled({
            ...getMockUserNotificationConfig(),
            tenantId,
          }),
          setEnabled({
            ...getMockUserNotificationConfig(),
          }),
        ];
        await Promise.all(
          userNotificationConfigs.map((userNotificationConfig) =>
            insertUserNotificationConfig(readModelDB, userNotificationConfig, 0)
          )
        );

        const retrievedUsers =
          await notificationConfigReadModelService.getTenantUsersWithNotificationEnabled(
            [tenantId],
            notificationType,
            notificationChannel
          );
        expect(retrievedUsers).toHaveLength(0);
      }
    );
  });
});
