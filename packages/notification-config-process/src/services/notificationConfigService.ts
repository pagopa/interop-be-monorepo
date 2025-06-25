import {
  AppContext,
  DB,
  WithLogger,
  eventRepository,
  UIAuthData,
} from "pagopa-interop-commons";
import {
  unsafeBrandId,
  notificationConfigEventToBinaryDataV2,
  TenantNotificationConfig,
  UserNotificationConfig,
} from "pagopa-interop-models";
import { notificationConfigApi } from "pagopa-interop-api-clients";
import {
  toCreateEventTenantNotificationConfigUpdated,
  toCreateEventUserNotificationConfigUpdated,
} from "../model/domain/toEvent.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function notificationConfigServiceBuilder(dbInstance: DB) {
  const repository = eventRepository(
    dbInstance,
    notificationConfigEventToBinaryDataV2
  );
  return {
    async updateTenantNotificationConfig(
      seed: notificationConfigApi.NotificationConfigSeed,
      {
        authData: { organizationId },
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData>>
    ): Promise<void> {
      logger.info(
        `Updating notification configuration for tenant ${organizationId}`
      );

      const tenantNotificationConfig: TenantNotificationConfig = {
        id: unsafeBrandId(organizationId), // FIXME replace with separate notification tenant ID
        tenantId: organizationId,
        config: seed,
      };

      const version = undefined; // FIXME use correct version

      const event = toCreateEventTenantNotificationConfigUpdated(
        organizationId,
        version,
        tenantNotificationConfig,
        correlationId
      );
      await repository.createEvent(event);
    },

    async updateUserNotificationConfig(
      seed: notificationConfigApi.UserNotificationConfigSeed,
      {
        authData: { userId, organizationId },
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData>>
    ): Promise<void> {
      logger.info(
        `Updating notification configuration for user ${userId} in tenant ${organizationId}`
      );

      const userNotificationConfig: UserNotificationConfig = {
        id: unsafeBrandId(userId), // FIXME replace with separate notification user ID
        userId,
        tenantId: organizationId,
        inAppConfig: seed.inAppConfig,
        emailConfig: seed.emailConfig,
      };

      const version = undefined; // FIXME use correct version

      const event = toCreateEventUserNotificationConfigUpdated(
        organizationId,
        version,
        userNotificationConfig,
        correlationId
      );
      await repository.createEvent(event);
    },
  };
}

export type NotificationConfigService = ReturnType<
  typeof notificationConfigServiceBuilder
>;
