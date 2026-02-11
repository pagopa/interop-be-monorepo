/* eslint-disable max-params */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { bffApi, notificationConfigApi } from "pagopa-interop-api-clients";
import { WithLogger, assertFeatureFlagEnabled } from "pagopa-interop-commons";
import { genericInternalError } from "pagopa-interop-models";
import { BffAppContext } from "../utilities/context.js";
import { config } from "../config/config.js";
import {
  toBffApiTenantNotificationConfig,
  toBffApiUserNotificationConfig,
} from "../api/notificationConfigApiConverter.js";

export function notificationConfigServiceBuilder(
  notificationConfigClient: notificationConfigApi.NotificationConfigHeyApiClient
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
      const { data, error } =
        await notificationConfigApi.getTenantNotificationConfig({
          headers,
          client: notificationConfigClient,
        });
      if (error) {
        throw genericInternalError(
          `Error getting tenant notification config: ${error.status} - ${error.title}`
        );
      }
      return toBffApiTenantNotificationConfig(data);
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
      const { error } =
        await notificationConfigApi.updateTenantNotificationConfig({
          body: seed,
          headers,
          client: notificationConfigClient,
        });
      if (error) {
        throw genericInternalError(
          `Error updating tenant notification config: ${error.status} - ${error.title}`
        );
      }
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
      const { data, error } =
        await notificationConfigApi.getUserNotificationConfig({
          headers,
          client: notificationConfigClient,
        });
      if (error) {
        throw genericInternalError(
          `Error getting user notification config: ${error.status} - ${error.title}`
        );
      }
      return toBffApiUserNotificationConfig(data);
    },
    updateUserNotificationConfig: async (
      seed: bffApi.UserNotificationConfigUpdateSeed,
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
      const {
        inAppConfig: {
          clientKeyAndProducerKeychainKeyAddedDeletedToClientUsers:
            inAppClientKeyAndProducerKeychainKeyAddedDeletedToClientUsers,
          ...restInAppConfig
        },
        emailConfig: {
          clientKeyAndProducerKeychainKeyAddedDeletedToClientUsers:
            emailClientKeyAndProducerKeychainKeyAddedDeletedToClientUsers,
          ...restEmailConfig
        },
        ...restSeed
      } = seed;
      const { error } =
        await notificationConfigApi.updateUserNotificationConfig({
          body: {
            ...restSeed,
            inAppConfig: {
              ...restInAppConfig,
              clientKeyAddedDeletedToClientUsers:
                inAppClientKeyAndProducerKeychainKeyAddedDeletedToClientUsers,
              clientKeyConsumerAddedDeletedToClientUsers:
                inAppClientKeyAndProducerKeychainKeyAddedDeletedToClientUsers,
              producerKeychainKeyAddedDeletedToClientUsers:
                inAppClientKeyAndProducerKeychainKeyAddedDeletedToClientUsers,
            },
            emailConfig: {
              ...restEmailConfig,
              clientKeyAddedDeletedToClientUsers:
                emailClientKeyAndProducerKeychainKeyAddedDeletedToClientUsers,
              clientKeyConsumerAddedDeletedToClientUsers:
                emailClientKeyAndProducerKeychainKeyAddedDeletedToClientUsers,
              producerKeychainKeyAddedDeletedToClientUsers:
                emailClientKeyAndProducerKeychainKeyAddedDeletedToClientUsers,
            },
          },
          headers,
          client: notificationConfigClient,
        });
      if (error) {
        throw genericInternalError(
          `Error updating user notification config: ${error.status} - ${error.title}`
        );
      }
    },
  };
}

export type NotificationConfigService = ReturnType<
  typeof notificationConfigServiceBuilder
>;
