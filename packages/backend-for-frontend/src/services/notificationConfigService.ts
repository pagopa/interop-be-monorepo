/* eslint-disable max-params */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { bffApi, notificationConfigApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";

import {
  toBffApiTenantNotificationConfig,
  toBffApiUserNotificationConfig,
  toNotificationConfigApiUserNotificationConfigUpdateSeed,
} from "../api/notificationConfigApiConverter.js";
import { BffAppContext } from "../utilities/context.js";

export function notificationConfigServiceBuilder(
  notificationConfigClient: notificationConfigApi.NotificationConfigProcessClient
) {
  return {
    getTenantNotificationConfig: async ({
      authData: { organizationId },
      logger,
      headers,
    }: WithLogger<BffAppContext>): Promise<bffApi.TenantNotificationConfig> => {
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
      seed: bffApi.UserNotificationConfigUpdateSeed,
      {
        authData: { userId, organizationId },
        logger,
        headers,
      }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Updating notification configuration for user ${userId} in tenant ${organizationId}`
      );
      await notificationConfigClient.updateUserNotificationConfig(
        toNotificationConfigApiUserNotificationConfigUpdateSeed(seed),
        {
          headers,
        }
      );
    },
  };
}

export type NotificationConfigService = ReturnType<
  typeof notificationConfigServiceBuilder
>;
