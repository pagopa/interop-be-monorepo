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
  NotificationTenant,
} from "pagopa-interop-models";
import { notificationConfigApi } from "pagopa-interop-api-clients";
import { toCreateEventNotificationTenantConfigUpdated } from "../model/domain/toEvent.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function notificationConfigServiceBuilder(dbInstance: DB) {
  const repository = eventRepository(
    dbInstance,
    notificationConfigEventToBinaryDataV2
  );
  return {
    async updateNotificationTenant(
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

      const notificationTenant: NotificationTenant = {
        id: unsafeBrandId(organizationId), // FIXME replace with separate notification tenant ID
        tenantId: organizationId,
        config: seed,
      };

      const version = undefined; // FIXME use correct version

      const event = toCreateEventNotificationTenantConfigUpdated(
        organizationId,
        version,
        notificationTenant,
        correlationId
      );
      await repository.createEvent(event);
    },
  };
}

export type NotificationConfigService = ReturnType<
  typeof notificationConfigServiceBuilder
>;
