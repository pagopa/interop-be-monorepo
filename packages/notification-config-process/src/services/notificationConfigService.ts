import { P, match } from "ts-pattern";
import {
  AppContext,
  DB,
  WithLogger,
  eventRepository,
  UIAuthData,
  InternalAuthData,
  overrideNotificationConfigByAdmittedRoles,
  isNotificationConfigAllowedForUserRoles,
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
  UserRole,
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
  toCreateEventUserNotificationConfigRoleAdded,
  toCreateEventUserNotificationConfigRoleRemoved,
  toCreateEventUserNotificationConfigUpdated,
} from "../model/domain/toEvent.js";
import {
  notificationConfigNotAllowedForUserRoles,
  tenantNotificationConfigAlreadyExists,
  tenantNotificationConfigNotFound,
  userNotificationConfigNotFound,
  userRoleNotInUserNotificationConfig,
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
      producerKeychainKeyAddedDeletedToClientUsers: false,
      purposeQuotaAdjustmentRequestToProducer: false,
      purposeOverQuotaStateToConsumer: false,
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
      producerKeychainKeyAddedDeletedToClientUsers: false,
      purposeQuotaAdjustmentRequestToProducer: false,
      purposeOverQuotaStateToConsumer: false,
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
      authData: { userId, organizationId, userRoles },
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
      const overrideByUserRoles =
        overrideNotificationConfigByAdmittedRoles(userRoles);
      return {
        ...config.data,
        inAppConfig: overrideByUserRoles(config.data.inAppConfig),
        emailConfig: overrideByUserRoles(config.data.emailConfig),
      };
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
        authData: { userId, organizationId, userRoles },
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData>>
    ): Promise<UserNotificationConfig> {
      logger.info(
        `Updating notification configuration for user ${userId} in tenant ${organizationId}`
      );

      if (
        !isNotificationConfigAllowedForUserRoles(seed.inAppConfig, userRoles) ||
        !isNotificationConfigAllowedForUserRoles(seed.emailConfig, userRoles)
      ) {
        throw notificationConfigNotAllowedForUserRoles(userId, organizationId);
      }

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
        userRoles: existingConfig.data.userRoles,
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

    async ensureUserNotificationConfigExistsWithRole(
      userId: UserId,
      tenantId: TenantId,
      userRole: UserRole,
      { correlationId, logger }: WithLogger<AppContext<InternalAuthData>>
    ): Promise<UserNotificationConfig> {
      logger.info(
        `Checking to ensure that a user notification configuration for user ${userId} in tenant ${tenantId} exists and includes role ${userRole}`
      );

      const existingConfig =
        await readModelService.getUserNotificationConfigByUserIdAndTenantId(
          userId,
          tenantId
        );

      return match(existingConfig)
        .with(undefined, async () => {
          logger.info(
            `Creating new default user notification configuration for user ${userId} in tenant ${tenantId} with role ${userRole}`
          );
          const userNotificationConfig: UserNotificationConfig = {
            id: generateId<UserNotificationConfigId>(),
            userId,
            tenantId,
            userRoles: [userRole],
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
        })
        .with(
          P.when((existingConfig) =>
            existingConfig.data.userRoles.includes(userRole)
          ),
          (existingConfig) => {
            logger.info(
              `User notification configuration for user ${userId} in tenant ${tenantId} already exists and has role ${userRole}, no update needed`
            );
            return existingConfig.data;
          }
        )
        .otherwise(async (existingConfig) => {
          logger.info(
            `Adding role ${userRole} to existing user notification configuration for user ${userId} in tenant ${tenantId}`
          );
          const userNotificationConfig: UserNotificationConfig = {
            ...existingConfig.data,
            userRoles: [...existingConfig.data.userRoles, userRole],
            updatedAt: new Date(),
          };
          const event = toCreateEventUserNotificationConfigRoleAdded(
            existingConfig.data.id,
            existingConfig.metadata.version,
            userNotificationConfig,
            userRole,
            correlationId
          );
          await repository.createEvent(event);
          return userNotificationConfig;
        });
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

    async removeUserNotificationConfigRole(
      userId: UserId,
      tenantId: TenantId,
      userRole: UserRole,
      { correlationId, logger }: WithLogger<AppContext<InternalAuthData>>
    ): Promise<void> {
      logger.info(
        `Removing role ${userRole} from notification configuration for user ${userId} in tenant ${tenantId}`
      );

      const existingConfig =
        await readModelService.getUserNotificationConfigByUserIdAndTenantId(
          userId,
          tenantId
        );

      if (existingConfig === undefined) {
        throw userNotificationConfigNotFound(userId, tenantId);
      }

      if (!existingConfig.data.userRoles.includes(userRole)) {
        throw userRoleNotInUserNotificationConfig(userId, tenantId, userRole);
      }

      const updatedUserRoles = existingConfig.data.userRoles.filter(
        (role) => role !== userRole
      );

      if (updatedUserRoles.length === 0) {
        logger.info(
          `Role ${userRole} was the only role for user ${userId} in tenant ${tenantId}, deleting the notification configuration`
        );
        const event = toCreateEventUserNotificationConfigDeleted(
          existingConfig.data.id,
          existingConfig.metadata.version,
          existingConfig.data,
          correlationId
        );
        await repository.createEvent(event);
      } else {
        const userNotificationConfig: UserNotificationConfig = {
          ...existingConfig.data,
          userRoles: [updatedUserRoles[0], ...updatedUserRoles.slice(1)],
          updatedAt: new Date(),
        };
        const event = toCreateEventUserNotificationConfigRoleRemoved(
          existingConfig.data.id,
          existingConfig.metadata.version,
          userNotificationConfig,
          userRole,
          correlationId
        );
        await repository.createEvent(event);
      }
    },
  };
}

export type NotificationConfigService = ReturnType<
  typeof notificationConfigServiceBuilder
>;
