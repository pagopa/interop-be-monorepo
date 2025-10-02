import {
  AppContext,
  DB,
  WithLogger,
  eventRepository,
  UIAuthData,
  InternalAuthData,
} from "pagopa-interop-commons";
import {
  notificationConfigEventToBinaryDataV2,
  TenantNotificationConfig,
  UserNotificationConfig,
  generateId,
  TenantNotificationConfigId,
  UserNotificationConfigId,
  UserId,
  TenantId,
  NotificationConfig,
  emailNotificationPreference,
} from "pagopa-interop-models";
import { notificationConfigApi } from "pagopa-interop-api-clients";
import {
  NotificationConfigReadModelService,
  TenantReadModelService,
} from "pagopa-interop-readmodel";
import {
  toCreateEventTenantNotificationConfigCreated,
  toCreateEventTenantNotificationConfigDeleted,
  toCreateEventTenantNotificationConfigUpdated,
  toCreateEventUserNotificationConfigCreated,
  toCreateEventUserNotificationConfigDeleted,
  toCreateEventUserNotificationConfigUpdated,
} from "../model/domain/toEvent.js";
import {
  tenantNotificationConfigAlreadyExists,
  tenantNotificationConfigNotFound,
  userNotificationConfigAlreadyExists,
  userNotificationConfigNotFound,
} from "../model/domain/errors.js";
import { apiEmailNotificationPreferenceToEmailNotificationPreference } from "../model/domain/apiConverter.js";

const defaultNotificationConfigs = {
  tenant: {
    enabled: true,
  },
  user: {
    inAppNotificationPreference: false,
    emailNotificationPreference: emailNotificationPreference.disabled,
    inApp: {
      agreementSuspendedUnsuspendedToProducer: false,
      agreementManagementToProducer: false,
      clientAddedRemovedToProducer: false,
      purposeStatusChangedToProducer: false,
      templateStatusChangedToProducer: false,
      agreementSuspendedUnsuspendedToConsumer: false,
      eserviceStateChangedToConsumer: false,
      agreementActivatedRejectedToConsumer: false,
      purposeActivatedRejectedToConsumer: false,
      purposeSuspendedUnsuspendedToConsumer: false,
      newEserviceTemplateVersionToInstantiator: false,
      eserviceTemplateNameChangedToInstantiator: false,
      eserviceTemplateStatusChangedToInstantiator: false,
      delegationApprovedRejectedToDelegator: false,
      eserviceNewVersionSubmittedToDelegator: false,
      eserviceNewVersionApprovedRejectedToDelegate: false,
      delegationSubmittedRevokedToDelegate: false,
      certifiedVerifiedAttributeAssignedRevokedToAssignee: false,
      clientKeyAddedDeletedToClientUsers: false,
    } satisfies NotificationConfig,
    email: {
      agreementSuspendedUnsuspendedToProducer: false,
      agreementManagementToProducer: false,
      clientAddedRemovedToProducer: false,
      purposeStatusChangedToProducer: false,
      templateStatusChangedToProducer: false,
      agreementSuspendedUnsuspendedToConsumer: false,
      eserviceStateChangedToConsumer: false,
      agreementActivatedRejectedToConsumer: false,
      purposeActivatedRejectedToConsumer: false,
      purposeSuspendedUnsuspendedToConsumer: false,
      newEserviceTemplateVersionToInstantiator: false,
      eserviceTemplateNameChangedToInstantiator: false,
      eserviceTemplateStatusChangedToInstantiator: false,
      delegationApprovedRejectedToDelegator: false,
      eserviceNewVersionSubmittedToDelegator: false,
      eserviceNewVersionApprovedRejectedToDelegate: false,
      delegationSubmittedRevokedToDelegate: false,
      certifiedVerifiedAttributeAssignedRevokedToAssignee: false,
      clientKeyAddedDeletedToClientUsers: false,
    } satisfies NotificationConfig,
  },
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function notificationConfigServiceBuilder(
  dbInstance: DB,
  readModelService: NotificationConfigReadModelService,
  tenantReadModelService: TenantReadModelService
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
      seed: notificationConfigApi.TenantNotificationConfigUpdateSeed,
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

      if (existingConfig === undefined) {
        throw tenantNotificationConfigNotFound(organizationId);
      }

      const tenantNotificationConfig: TenantNotificationConfig = {
        id: existingConfig.data.id,
        tenantId: organizationId,
        enabled: seed.enabled,
        createdAt: existingConfig.data.createdAt,
        updatedAt: new Date(),
      };

      const event = toCreateEventTenantNotificationConfigUpdated(
        existingConfig.data.id,
        existingConfig.metadata.version,
        tenantNotificationConfig,
        correlationId
      );
      await repository.createEvent(event);
      return tenantNotificationConfig;
    },

    async updateUserNotificationConfig(
      seed: notificationConfigApi.UserNotificationConfigUpdateSeed,
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

      if (existingConfig === undefined) {
        throw userNotificationConfigNotFound(userId, organizationId);
      }

      const userNotificationConfig: UserNotificationConfig = {
        id: existingConfig.data.id,
        userId,
        tenantId: organizationId,
        inAppNotificationPreference: seed.inAppNotificationPreference,
        emailNotificationPreference:
          apiEmailNotificationPreferenceToEmailNotificationPreference(
            seed.emailNotificationPreference
          ),
        inAppConfig: seed.inAppConfig,
        emailConfig: seed.emailConfig,
        createdAt: existingConfig.data.createdAt,
        updatedAt: new Date(),
      };

      const event = toCreateEventUserNotificationConfigUpdated(
        existingConfig.data.id,
        existingConfig.metadata.version,
        userNotificationConfig,
        correlationId
      );
      await repository.createEvent(event);
      return userNotificationConfig;
    },

    async createTenantDefaultNotificationConfig(
      tenantId: TenantId,
      { correlationId, logger }: WithLogger<AppContext<InternalAuthData>>
    ): Promise<TenantNotificationConfig> {
      logger.info(
        `Creating default notification configuration for tenant ${tenantId}`
      );

      const existingConfig =
        await readModelService.getTenantNotificationConfigByTenantId(tenantId);

      if (existingConfig !== undefined) {
        throw tenantNotificationConfigAlreadyExists(tenantId);
      }

      if (
        (await tenantReadModelService.getTenantById(tenantId)) === undefined
      ) {
        logger.warn(
          `Tenant ${tenantId} not found, creating default notification configuration anyway (assuming the readmodel is not yet updated with the new tenant)`
        );
      }

      const tenantNotificationConfig: TenantNotificationConfig = {
        id: generateId<TenantNotificationConfigId>(),
        tenantId,
        enabled: defaultNotificationConfigs.tenant.enabled,
        createdAt: new Date(),
        updatedAt: undefined,
      };

      const event = toCreateEventTenantNotificationConfigCreated(
        tenantNotificationConfig.id,
        tenantNotificationConfig,
        correlationId
      );
      await repository.createEvent(event);
      return tenantNotificationConfig;
    },

    async createUserDefaultNotificationConfig(
      userId: UserId,
      tenantId: TenantId,
      { correlationId, logger }: WithLogger<AppContext<InternalAuthData>>
    ): Promise<UserNotificationConfig> {
      logger.info(
        `Updating default notification configuration for user ${userId} in tenant ${tenantId}`
      );

      const existingConfig =
        await readModelService.getUserNotificationConfigByUserIdAndTenantId(
          userId,
          tenantId
        );

      if (existingConfig !== undefined) {
        throw userNotificationConfigAlreadyExists(userId, tenantId);
      }

      const userNotificationConfig: UserNotificationConfig = {
        id: generateId<UserNotificationConfigId>(),
        userId,
        tenantId,
        inAppNotificationPreference:
          defaultNotificationConfigs.user.inAppNotificationPreference,
        emailNotificationPreference:
          defaultNotificationConfigs.user.emailNotificationPreference,
        inAppConfig: defaultNotificationConfigs.user.inApp,
        emailConfig: defaultNotificationConfigs.user.email,
        createdAt: new Date(),
        updatedAt: undefined,
      };

      const event = toCreateEventUserNotificationConfigCreated(
        userNotificationConfig.id,
        userNotificationConfig,
        correlationId
      );
      await repository.createEvent(event);
      return userNotificationConfig;
    },

    async deleteTenantNotificationConfig(
      tenantId: TenantId,
      { correlationId, logger }: WithLogger<AppContext<InternalAuthData>>
    ): Promise<void> {
      logger.info(`Deleting notification configuration for tenant ${tenantId}`);

      const existingConfig =
        await readModelService.getTenantNotificationConfigByTenantId(tenantId);

      if (existingConfig === undefined) {
        throw tenantNotificationConfigNotFound(tenantId);
      }

      if (
        (await tenantReadModelService.getTenantById(tenantId)) !== undefined
      ) {
        logger.warn(
          `Tenant ${tenantId} still exists, deleting notification configuration anyway (assuming the readmodel is not yet updated with the deletion)`
        );
      }

      const event = toCreateEventTenantNotificationConfigDeleted(
        existingConfig.data.id,
        existingConfig.metadata.version,
        existingConfig.data,
        correlationId
      );
      await repository.createEvent(event);
    },

    async deleteUserNotificationConfig(
      userId: UserId,
      tenantId: TenantId,
      { correlationId, logger }: WithLogger<AppContext<InternalAuthData>>
    ): Promise<void> {
      logger.info(
        `Deleting notification configuration for user ${userId} in tenant ${tenantId}`
      );

      const existingConfig =
        await readModelService.getUserNotificationConfigByUserIdAndTenantId(
          userId,
          tenantId
        );

      if (existingConfig === undefined) {
        throw userNotificationConfigNotFound(userId, tenantId);
      }

      const event = toCreateEventUserNotificationConfigDeleted(
        existingConfig.data.id,
        existingConfig.metadata.version,
        existingConfig.data,
        correlationId
      );
      await repository.createEvent(event);
    },
  };
}

export type NotificationConfigService = ReturnType<
  typeof notificationConfigServiceBuilder
>;
