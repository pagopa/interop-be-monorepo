import { describe, expect, it } from "vitest";
import {
  NotificationConfigEventEnvelope,
  TenantNotificationConfig,
  TenantNotificationConfigCreatedV2,
  TenantNotificationConfigDeletedV2,
  TenantNotificationConfigUpdatedV2,
  UserNotificationConfig,
  UserNotificationConfigCreatedV2,
  UserNotificationConfigDeletedV2,
  UserNotificationConfigRoleAddedV2,
  UserNotificationConfigRoleRemovedV2,
  UserNotificationConfigUpdatedV2,
  generateId,
  toTenantNotificationConfigV2,
  toUserNotificationConfigV2,
  toUserRoleV2,
  userRole,
} from "pagopa-interop-models";
import {
  getMockTenantNotificationConfig,
  getMockUserNotificationConfig,
} from "pagopa-interop-commons-test/index.js";
import { genericLogger } from "pagopa-interop-commons";
import { handleMessageV2 } from "../src/consumerServiceV2.js";
import {
  notificationConfigReadModelService,
  notificationConfigReadModelWriteService,
} from "./utils.js";

describe("database test", async () => {
  describe("Events V2", async () => {
    it("TenantNotificationConfigCreated", async () => {
      const tenantNotificationConfig = getMockTenantNotificationConfig();

      const payload: TenantNotificationConfigCreatedV2 = {
        tenantNotificationConfig: toTenantNotificationConfigV2(
          tenantNotificationConfig
        ),
      };

      const message: NotificationConfigEventEnvelope = {
        sequence_num: 1,
        stream_id: tenantNotificationConfig.id,
        version: 0,
        type: "TenantNotificationConfigCreated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, notificationConfigReadModelWriteService, genericLogger);

      const retrievedConfig =
        await notificationConfigReadModelService.getTenantNotificationConfigByTenantId(
          tenantNotificationConfig.tenantId
        );

      expect(retrievedConfig).toStrictEqual({
        data: tenantNotificationConfig,
        metadata: { version: 0 },
      });
    });

    it("UserNotificationConfigCreated", async () => {
      const userNotificationConfig = getMockUserNotificationConfig();

      const payload: UserNotificationConfigCreatedV2 = {
        userNotificationConfig: toUserNotificationConfigV2(
          userNotificationConfig
        ),
      };

      const message: NotificationConfigEventEnvelope = {
        sequence_num: 1,
        stream_id: userNotificationConfig.id,
        version: 0,
        type: "UserNotificationConfigCreated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, notificationConfigReadModelWriteService, genericLogger);

      const retrievedConfig =
        await notificationConfigReadModelService.getUserNotificationConfigByUserIdAndTenantId(
          userNotificationConfig.userId,
          userNotificationConfig.tenantId
        );

      expect(retrievedConfig).toStrictEqual({
        data: userNotificationConfig,
        metadata: { version: 0 },
      });
    });

    it("TenantNotificationConfigUpdated", async () => {
      const tenantNotificationConfig: TenantNotificationConfig =
        getMockTenantNotificationConfig();
      await notificationConfigReadModelWriteService.upsertTenantNotificationConfig(
        tenantNotificationConfig,
        1
      );

      const updatedTenantNotificationConfig: TenantNotificationConfig = {
        ...tenantNotificationConfig,
        enabled: !tenantNotificationConfig.enabled,
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
      await handleMessageV2(message, notificationConfigReadModelWriteService, genericLogger);

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
      const userNotificationConfig: UserNotificationConfig =
        getMockUserNotificationConfig();
      await notificationConfigReadModelWriteService.upsertUserNotificationConfig(
        userNotificationConfig,
        1
      );

      const {
        inAppConfig: initialInAppConfig,
        emailConfig: initialEmailConfig,
      } = userNotificationConfig;

      const updatedUserNotificationConfig: UserNotificationConfig = {
        ...userNotificationConfig,
        inAppConfig: {
          agreementSuspendedUnsuspendedToProducer:
            !initialInAppConfig.agreementSuspendedUnsuspendedToProducer,
          agreementManagementToProducer:
            !initialInAppConfig.agreementManagementToProducer,
          clientAddedRemovedToProducer:
            !initialInAppConfig.clientAddedRemovedToProducer,
          purposeStatusChangedToProducer:
            !initialInAppConfig.purposeStatusChangedToProducer,
          templateStatusChangedToProducer:
            !initialInAppConfig.templateStatusChangedToProducer,
          agreementSuspendedUnsuspendedToConsumer:
            !initialInAppConfig.agreementSuspendedUnsuspendedToConsumer,
          eserviceStateChangedToConsumer:
            !initialInAppConfig.eserviceStateChangedToConsumer,
          agreementActivatedRejectedToConsumer:
            !initialInAppConfig.agreementActivatedRejectedToConsumer,
          purposeActivatedRejectedToConsumer:
            !initialInAppConfig.purposeActivatedRejectedToConsumer,
          purposeSuspendedUnsuspendedToConsumer:
            !initialInAppConfig.purposeSuspendedUnsuspendedToConsumer,
          newEserviceTemplateVersionToInstantiator:
            !initialInAppConfig.newEserviceTemplateVersionToInstantiator,
          eserviceTemplateNameChangedToInstantiator:
            !initialInAppConfig.eserviceTemplateNameChangedToInstantiator,
          eserviceTemplateStatusChangedToInstantiator:
            !initialInAppConfig.eserviceTemplateStatusChangedToInstantiator,
          delegationApprovedRejectedToDelegator:
            !initialInAppConfig.delegationApprovedRejectedToDelegator,
          eserviceNewVersionSubmittedToDelegator:
            !initialInAppConfig.eserviceNewVersionSubmittedToDelegator,
          eserviceNewVersionApprovedRejectedToDelegate:
            !initialInAppConfig.eserviceNewVersionApprovedRejectedToDelegate,
          delegationSubmittedRevokedToDelegate:
            !initialInAppConfig.delegationSubmittedRevokedToDelegate,
          certifiedVerifiedAttributeAssignedRevokedToAssignee:
            !initialInAppConfig.certifiedVerifiedAttributeAssignedRevokedToAssignee,
          clientKeyAddedDeletedToClientUsers:
            !initialInAppConfig.clientKeyAddedDeletedToClientUsers,
          producerKeychainKeyAddedDeletedToClientUsers:
            !initialInAppConfig.producerKeychainKeyAddedDeletedToClientUsers,
          purposeQuotaAdjustmentRequestToProducer:
            !initialInAppConfig.purposeQuotaAdjustmentRequestToProducer,
          purposeOverQuotaStateToConsumer:
            !initialInAppConfig.purposeOverQuotaStateToConsumer,
        },
        emailConfig: {
          agreementSuspendedUnsuspendedToProducer:
            !initialEmailConfig.agreementSuspendedUnsuspendedToProducer,
          agreementManagementToProducer:
            !initialEmailConfig.agreementManagementToProducer,
          clientAddedRemovedToProducer:
            !initialEmailConfig.clientAddedRemovedToProducer,
          purposeStatusChangedToProducer:
            !initialEmailConfig.purposeStatusChangedToProducer,
          templateStatusChangedToProducer:
            !initialEmailConfig.templateStatusChangedToProducer,
          agreementSuspendedUnsuspendedToConsumer:
            !initialEmailConfig.agreementSuspendedUnsuspendedToConsumer,
          eserviceStateChangedToConsumer:
            !initialEmailConfig.eserviceStateChangedToConsumer,
          agreementActivatedRejectedToConsumer:
            !initialEmailConfig.agreementActivatedRejectedToConsumer,
          purposeActivatedRejectedToConsumer:
            !initialEmailConfig.purposeActivatedRejectedToConsumer,
          purposeSuspendedUnsuspendedToConsumer:
            !initialEmailConfig.purposeSuspendedUnsuspendedToConsumer,
          newEserviceTemplateVersionToInstantiator:
            !initialEmailConfig.newEserviceTemplateVersionToInstantiator,
          eserviceTemplateNameChangedToInstantiator:
            !initialEmailConfig.eserviceTemplateNameChangedToInstantiator,
          eserviceTemplateStatusChangedToInstantiator:
            !initialEmailConfig.eserviceTemplateStatusChangedToInstantiator,
          delegationApprovedRejectedToDelegator:
            !initialEmailConfig.delegationApprovedRejectedToDelegator,
          eserviceNewVersionSubmittedToDelegator:
            !initialEmailConfig.eserviceNewVersionSubmittedToDelegator,
          eserviceNewVersionApprovedRejectedToDelegate:
            !initialEmailConfig.eserviceNewVersionApprovedRejectedToDelegate,
          delegationSubmittedRevokedToDelegate:
            !initialEmailConfig.delegationSubmittedRevokedToDelegate,
          certifiedVerifiedAttributeAssignedRevokedToAssignee:
            !initialEmailConfig.certifiedVerifiedAttributeAssignedRevokedToAssignee,
          clientKeyAddedDeletedToClientUsers:
            !initialEmailConfig.clientKeyAddedDeletedToClientUsers,
          producerKeychainKeyAddedDeletedToClientUsers:
            !initialEmailConfig.producerKeychainKeyAddedDeletedToClientUsers,
          purposeQuotaAdjustmentRequestToProducer:
            !initialEmailConfig.purposeQuotaAdjustmentRequestToProducer,
          purposeOverQuotaStateToConsumer:
            !initialEmailConfig.purposeOverQuotaStateToConsumer,
        },
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
      await handleMessageV2(message, notificationConfigReadModelWriteService, genericLogger);

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

    it("UserNotificationConfigRoleAdded", async () => {
      const userNotificationConfig: UserNotificationConfig = {
        ...getMockUserNotificationConfig(),
        userRoles: [userRole.API_ROLE],
      };
      await notificationConfigReadModelWriteService.upsertUserNotificationConfig(
        userNotificationConfig,
        1
      );

      const updatedUserNotificationConfig: UserNotificationConfig = {
        ...userNotificationConfig,
        userRoles: [userRole.API_ROLE, userRole.SECURITY_ROLE],
      };

      const payload: UserNotificationConfigRoleAddedV2 = {
        userNotificationConfig: toUserNotificationConfigV2(
          updatedUserNotificationConfig
        ),
        userRole: toUserRoleV2(userRole.SECURITY_ROLE),
      };

      const message: NotificationConfigEventEnvelope = {
        sequence_num: 1,
        stream_id: userNotificationConfig.id,
        version: 2,
        type: "UserNotificationConfigRoleAdded",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, notificationConfigReadModelWriteService, genericLogger);

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

    it("UserNotificationConfigRoleRemoved", async () => {
      const userNotificationConfig: UserNotificationConfig = {
        ...getMockUserNotificationConfig(),
        userRoles: [userRole.API_ROLE, userRole.SECURITY_ROLE],
      };
      await notificationConfigReadModelWriteService.upsertUserNotificationConfig(
        userNotificationConfig,
        1
      );

      const updatedUserNotificationConfig: UserNotificationConfig = {
        ...userNotificationConfig,
        userRoles: [userRole.API_ROLE],
      };

      const payload: UserNotificationConfigRoleRemovedV2 = {
        userNotificationConfig: toUserNotificationConfigV2(
          updatedUserNotificationConfig
        ),
        userRole: toUserRoleV2(userRole.SECURITY_ROLE),
      };

      const message: NotificationConfigEventEnvelope = {
        sequence_num: 1,
        stream_id: userNotificationConfig.id,
        version: 2,
        type: "UserNotificationConfigRoleRemoved",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, notificationConfigReadModelWriteService, genericLogger);

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

    it("TenantNotificationConfigDeleted", async () => {
      const tenantNotificationConfig = getMockTenantNotificationConfig();
      await notificationConfigReadModelWriteService.upsertTenantNotificationConfig(
        tenantNotificationConfig,
        1
      );

      const payload: TenantNotificationConfigDeletedV2 = {
        tenantNotificationConfig: toTenantNotificationConfigV2(
          tenantNotificationConfig
        ),
      };

      const message: NotificationConfigEventEnvelope = {
        sequence_num: 1,
        stream_id: tenantNotificationConfig.id,
        version: 2,
        type: "TenantNotificationConfigDeleted",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, notificationConfigReadModelWriteService, genericLogger);

      const retrievedConfig =
        await notificationConfigReadModelService.getTenantNotificationConfigByTenantId(
          tenantNotificationConfig.tenantId
        );

      expect(retrievedConfig).toBeUndefined();
    });

    it("UserNotificationConfigDeleted", async () => {
      const userNotificationConfig = getMockUserNotificationConfig();
      await notificationConfigReadModelWriteService.upsertUserNotificationConfig(
        userNotificationConfig,
        1
      );

      const payload: UserNotificationConfigDeletedV2 = {
        userNotificationConfig: toUserNotificationConfigV2(
          userNotificationConfig
        ),
      };

      const message: NotificationConfigEventEnvelope = {
        sequence_num: 1,
        stream_id: userNotificationConfig.id,
        version: 2,
        type: "UserNotificationConfigDeleted",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, notificationConfigReadModelWriteService, genericLogger);

      const retrievedConfig =
        await notificationConfigReadModelService.getUserNotificationConfigByUserIdAndTenantId(
          userNotificationConfig.userId,
          userNotificationConfig.tenantId
        );

      expect(retrievedConfig).toBeUndefined();
    });

    describe("UserNotificationConfigCreated merge scenarios", () => {
      it("should merge roles when creating config with different ID but same userId+tenantId - keeps OLD id", async () => {
        // Create an existing config with ID = A
        const existingConfig: UserNotificationConfig = {
          ...getMockUserNotificationConfig(),
          userRoles: [userRole.API_ROLE],
        };
        await notificationConfigReadModelWriteService.upsertUserNotificationConfig(
          existingConfig,
          1
        );

        // Create a new config with same userId+tenantId but different ID (ID = B)
        const newConfig: UserNotificationConfig = {
          ...existingConfig,
          id: generateId(), // Different ID
          userRoles: [userRole.SECURITY_ROLE],
          createdAt: new Date(),
        };

        const payload: UserNotificationConfigCreatedV2 = {
          userNotificationConfig: toUserNotificationConfigV2(newConfig),
        };

        const message: NotificationConfigEventEnvelope = {
          sequence_num: 1,
          stream_id: newConfig.id,
          version: 0,
          type: "UserNotificationConfigCreated",
          event_version: 2,
          data: payload,
          log_date: new Date(),
        };

        await handleMessageV2(
          message,
          notificationConfigReadModelWriteService,
          genericLogger
        );

        const retrievedConfig =
          await notificationConfigReadModelService.getUserNotificationConfigByUserIdAndTenantId(
            existingConfig.userId,
            existingConfig.tenantId
          );

        // Should keep the OLD ID (existingConfig.id)
        expect(retrievedConfig?.data.id).toBe(existingConfig.id);
        // Should have merged roles
        expect(retrievedConfig?.data.userRoles).toEqual(
          expect.arrayContaining([userRole.API_ROLE, userRole.SECURITY_ROLE])
        );
        expect(retrievedConfig?.data.userRoles).toHaveLength(2);
        // metadataVersion should remain unchanged
        expect(retrievedConfig?.metadata.version).toBe(1);
        // updatedAt should be updated to the new event's createdAt
        expect(retrievedConfig?.data.updatedAt).toEqual(newConfig.createdAt);
      });

      it("should throw error when Created event arrives with same ID as existing record", async () => {
        const existingConfig = getMockUserNotificationConfig();
        await notificationConfigReadModelWriteService.upsertUserNotificationConfig(
          existingConfig,
          1
        );

        // Try to create with the SAME ID
        const payload: UserNotificationConfigCreatedV2 = {
          userNotificationConfig: toUserNotificationConfigV2(existingConfig),
        };

        const message: NotificationConfigEventEnvelope = {
          sequence_num: 1,
          stream_id: existingConfig.id,
          version: 0,
          type: "UserNotificationConfigCreated",
          event_version: 2,
          data: payload,
          log_date: new Date(),
        };

        await expect(
          handleMessageV2(
            message,
            notificationConfigReadModelWriteService,
            genericLogger
          )
        ).rejects.toThrow(
          `UserNotificationConfigCreated received for existing id ${existingConfig.id}`
        );
      });

      it("should delete record with old ID, and delete for new ID should be no-op", async () => {
        // Create an existing config with ID = A
        const existingConfig: UserNotificationConfig = {
          ...getMockUserNotificationConfig(),
          userRoles: [userRole.API_ROLE],
        };
        await notificationConfigReadModelWriteService.upsertUserNotificationConfig(
          existingConfig,
          1
        );

        // Simulate a Created event with different ID (ID = B) - triggers merge
        const newId = generateId<typeof existingConfig.id>();
        const newConfig: UserNotificationConfig = {
          ...existingConfig,
          id: newId,
          userRoles: [userRole.SECURITY_ROLE],
          createdAt: new Date(),
        };

        const createPayload: UserNotificationConfigCreatedV2 = {
          userNotificationConfig: toUserNotificationConfigV2(newConfig),
        };

        const createMessage: NotificationConfigEventEnvelope = {
          sequence_num: 1,
          stream_id: newConfig.id,
          version: 0,
          type: "UserNotificationConfigCreated",
          event_version: 2,
          data: createPayload,
          log_date: new Date(),
        };

        await handleMessageV2(
          createMessage,
          notificationConfigReadModelWriteService,
          genericLogger
        );

        // Verify record exists with old ID
        let retrievedConfig =
          await notificationConfigReadModelService.getUserNotificationConfigByUserIdAndTenantId(
            existingConfig.userId,
            existingConfig.tenantId
          );
        expect(retrievedConfig?.data.id).toBe(existingConfig.id);

        // Delete for NEW ID should be a no-op (nothing to delete)
        const deleteNewPayload: UserNotificationConfigDeletedV2 = {
          userNotificationConfig: toUserNotificationConfigV2(newConfig),
        };

        const deleteNewMessage: NotificationConfigEventEnvelope = {
          sequence_num: 1,
          stream_id: newConfig.id,
          version: 1,
          type: "UserNotificationConfigDeleted",
          event_version: 2,
          data: deleteNewPayload,
          log_date: new Date(),
        };

        await handleMessageV2(
          deleteNewMessage,
          notificationConfigReadModelWriteService,
          genericLogger
        );

        // Record should still exist (delete for new ID was no-op)
        retrievedConfig =
          await notificationConfigReadModelService.getUserNotificationConfigByUserIdAndTenantId(
            existingConfig.userId,
            existingConfig.tenantId
          );
        expect(retrievedConfig?.data.id).toBe(existingConfig.id);

        // Delete for OLD ID should work
        const deleteOldPayload: UserNotificationConfigDeletedV2 = {
          userNotificationConfig: toUserNotificationConfigV2(existingConfig),
        };

        const deleteOldMessage: NotificationConfigEventEnvelope = {
          sequence_num: 1,
          stream_id: existingConfig.id,
          version: 2,
          type: "UserNotificationConfigDeleted",
          event_version: 2,
          data: deleteOldPayload,
          log_date: new Date(),
        };

        await handleMessageV2(
          deleteOldMessage,
          notificationConfigReadModelWriteService,
          genericLogger
        );

        // Record should be deleted
        retrievedConfig =
          await notificationConfigReadModelService.getUserNotificationConfigByUserIdAndTenantId(
            existingConfig.userId,
            existingConfig.tenantId
          );
        expect(retrievedConfig).toBeUndefined();
      });
    });
  });
});
