/* eslint-disable max-params */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { bffApi, notificationConfigApi } from "pagopa-interop-api-clients";
import { WithLogger, assertFeatureFlagEnabled } from "pagopa-interop-commons";
import { NotificationConfigProcessClient } from "../clients/clientsProvider.js";
import { BffAppContext } from "../utilities/context.js";
import { config } from "../config/config.js";
import {
  toBffApiTenantNotificationConfig,
  toBffApiUserNotificationConfig,
} from "../api/notificationConfigApiConverter.js";

export function notificationConfigServiceBuilder(
  notificationConfigClient: NotificationConfigProcessClient
) {
  return {
    getTenantNotificationConfig: async ({
      authData: { organizationId },
      logger,
      headers,
    }: WithLogger<BffAppContext>): Promise<bffApi.TenantNotificationConfig> => {
      assertFeatureFlagEnabled(config, "featureFlagNotificationConfig");
      logger.info(
        `Getting notification configuration for tenant ${organizationId}`
      );
      return toBffApiTenantNotificationConfig(
        await notificationConfigClient.getTenantNotificationConfig({
          headers,
        })
      );
    },
    updateTenantNotificationConfig: async (
      seed: notificationConfigApi.TenantNotificationConfigUpdateSeed,
      {
        authData: { organizationId },
        logger,
        headers,
      }: WithLogger<BffAppContext>
    ): Promise<void> => {
      assertFeatureFlagEnabled(config, "featureFlagNotificationConfig");
      logger.info(
        `Updating notification configuration for tenant ${organizationId}`
      );
      await notificationConfigClient.updateTenantNotificationConfig(seed, {
        headers,
      });
    },
    getUserNotificationConfig: async ({
      authData: { userId, organizationId },
      logger,
      headers,
    }: WithLogger<BffAppContext>): Promise<bffApi.UserNotificationConfig> => {
      assertFeatureFlagEnabled(config, "featureFlagNotificationConfig");
      logger.info(
        `Getting notification configuration for user ${userId} in tenant ${organizationId}`
      );
      return toBffApiUserNotificationConfig(
        await notificationConfigClient.getUserNotificationConfig({
          headers,
        })
      );
    },
    updateUserNotificationConfig: async (
      seed: notificationConfigApi.UserNotificationConfigUpdateSeed,
      {
        authData: { userId, organizationId },
        logger,
        headers,
      }: WithLogger<BffAppContext>
    ): Promise<void> => {
      assertFeatureFlagEnabled(config, "featureFlagNotificationConfig");
      logger.info(
        `Updating notification configuration for user ${userId} in tenant ${organizationId}`
      );
      await notificationConfigClient.updateUserNotificationConfig(seed, {
        headers,
      });
    },
  };
}

export type NotificationConfigService = ReturnType<
  typeof notificationConfigServiceBuilder
>;
