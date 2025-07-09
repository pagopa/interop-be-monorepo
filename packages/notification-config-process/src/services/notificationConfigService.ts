import {
  AppContext,
  DB,
  WithLogger,
  eventRepository,
  UIAuthData,
} from "pagopa-interop-commons";
import {
  notificationConfigEventToBinaryDataV2,
  TenantNotificationConfig,
  UserNotificationConfig,
  generateId,
  TenantNotificationConfigId,
  UserNotificationConfigId,
} from "pagopa-interop-models";
import { notificationConfigApi } from "pagopa-interop-api-clients";
import { NotificationConfigReadModelService } from "pagopa-interop-readmodel";
import {
  toCreateEventTenantNotificationConfigUpdated,
  toCreateEventUserNotificationConfigUpdated,
} from "../model/domain/toEvent.js";
import {
  tenantNotificationConfigNotFound,
  userNotificationConfigNotFound,
} from "../model/domain/errors.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function notificationConfigServiceBuilder(
  dbInstance: DB,
  readModelService: NotificationConfigReadModelService
) {
  const repository = eventRepository(
    dbInstance,
    notificationConfigEventToBinaryDataV2
  );
  return {
    async getTenantNotificationConfig({
      authData: { organizationId },
      logger,
    }: WithLogger<AppContext<UIAuthData>>): Promise<TenantNotificationConfig> {
      logger.info(
        `Getting notification configuration for tenant ${organizationId}`
      );
      const config =
        await readModelService.getTenantNotificationConfigByTenantId(
          organizationId
        );
      if (config === undefined) {
        throw tenantNotificationConfigNotFound(organizationId);
      }
      return config.data;
    },

    async getUserNotificationConfig({
      authData: { userId, organizationId },
      logger,
    }: WithLogger<AppContext<UIAuthData>>): Promise<UserNotificationConfig> {
      logger.info(
        `Getting notification configuration for user ${userId} in tenant ${organizationId}`
      );
      const config =
        await readModelService.getUserNotificationConfigByUserIdAndTenantId(
          userId,
          organizationId
        );
      if (config === undefined) {
        throw userNotificationConfigNotFound(userId, organizationId);
      }
      return config.data;
    },

    async updateTenantNotificationConfig(
      seed: notificationConfigApi.NotificationConfigSeed,
      {
        authData: { organizationId },
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData>>
    ): Promise<TenantNotificationConfig> {
      logger.info(
        `Updating notification configuration for tenant ${organizationId}`
      );

      const existingConfig =
        await readModelService.getTenantNotificationConfigByTenantId(
          organizationId
        );

      const { id, version, createdAt, updatedAt } =
        existingConfig !== undefined
          ? {
              id: existingConfig.data.id,
              version: existingConfig.metadata.version,
              createdAt: existingConfig.data.createdAt,
              updatedAt: new Date(),
            }
          : {
              id: generateId<TenantNotificationConfigId>(),
              version: undefined,
              createdAt: new Date(),
              updatedAt: undefined,
            };

      const tenantNotificationConfig: TenantNotificationConfig = {
        id,
        tenantId: organizationId,
        config: seed,
        createdAt,
        updatedAt,
      };

      const event = toCreateEventTenantNotificationConfigUpdated(
        id,
        version,
        tenantNotificationConfig,
        correlationId
      );
      await repository.createEvent(event);
      return tenantNotificationConfig;
    },

    async updateUserNotificationConfig(
      seed: notificationConfigApi.UserNotificationConfigSeed,
      {
        authData: { userId, organizationId },
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData>>
    ): Promise<UserNotificationConfig> {
      logger.info(
        `Updating notification configuration for user ${userId} in tenant ${organizationId}`
      );

      const existingConfig =
        await readModelService.getUserNotificationConfigByUserIdAndTenantId(
          userId,
          organizationId
        );

      const { id, version, createdAt, updatedAt } =
        existingConfig !== undefined
          ? {
              id: existingConfig.data.id,
              version: existingConfig.metadata.version,
              createdAt: existingConfig.data.createdAt,
              updatedAt: new Date(),
            }
          : {
              id: generateId<UserNotificationConfigId>(),
              version: undefined,
              createdAt: new Date(),
              updatedAt: undefined,
            };

      const userNotificationConfig: UserNotificationConfig = {
        id,
        userId,
        tenantId: organizationId,
        inAppConfig: seed.inAppConfig,
        emailConfig: seed.emailConfig,
        createdAt,
        updatedAt,
      };

      const event = toCreateEventUserNotificationConfigUpdated(
        id,
        version,
        userNotificationConfig,
        correlationId
      );
      await repository.createEvent(event);
      return userNotificationConfig;
    },
  };
}

export type NotificationConfigService = ReturnType<
  typeof notificationConfigServiceBuilder
>;
