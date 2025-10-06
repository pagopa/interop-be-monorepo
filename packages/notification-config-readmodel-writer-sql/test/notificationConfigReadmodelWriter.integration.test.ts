import { z } from "zod";
import { generateMock } from "@anatine/zod-mock";
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
  UserNotificationConfigUpdatedV2,
  emailNotificationPreference,
  generateId,
  toTenantNotificationConfigV2,
  toUserNotificationConfigV2,
} from "pagopa-interop-models";
import {
  getMockTenantNotificationConfig,
  getMockUserNotificationConfig,
} from "pagopa-interop-commons-test/index.js";
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
      await handleMessageV2(message, notificationConfigReadModelWriteService);

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
      await handleMessageV2(message, notificationConfigReadModelWriteService);

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
      await handleMessageV2(message, notificationConfigReadModelWriteService);

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
      const userNotificationConfig: UserNotificationConfig = {
        id: generateId(),
        userId: generateId(),
        tenantId: generateId(),
        inAppNotificationPreference: true,
        emailNotificationPreference: emailNotificationPreference.enabled,
        inAppConfig: {
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
        },
        emailConfig: {
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
        },
        createdAt: generateMock(z.coerce.date()),
        updatedAt: generateMock(z.coerce.date().optional()),
      };
      await notificationConfigReadModelWriteService.upsertUserNotificationConfig(
        userNotificationConfig,
        1
      );

      const updatedUserNotificationConfig: UserNotificationConfig = {
        ...userNotificationConfig,
        inAppConfig: {
          agreementSuspendedUnsuspendedToProducer: true,
          agreementManagementToProducer: true,
          clientAddedRemovedToProducer: true,
          purposeStatusChangedToProducer: true,
          templateStatusChangedToProducer: true,
          agreementSuspendedUnsuspendedToConsumer: true,
          eserviceStateChangedToConsumer: true,
          agreementActivatedRejectedToConsumer: true,
          purposeActivatedRejectedToConsumer: true,
          purposeSuspendedUnsuspendedToConsumer: true,
          newEserviceTemplateVersionToInstantiator: true,
          eserviceTemplateNameChangedToInstantiator: true,
          eserviceTemplateStatusChangedToInstantiator: true,
          delegationApprovedRejectedToDelegator: true,
          eserviceNewVersionSubmittedToDelegator: true,
          eserviceNewVersionApprovedRejectedToDelegate: true,
          delegationSubmittedRevokedToDelegate: true,
          certifiedVerifiedAttributeAssignedRevokedToAssignee: true,
          clientKeyAddedDeletedToClientUsers: true,
          producerKeychainKeyAddedDeletedToClientUsers: true,
        },
        emailConfig: {
          agreementSuspendedUnsuspendedToProducer: true,
          agreementManagementToProducer: true,
          clientAddedRemovedToProducer: true,
          purposeStatusChangedToProducer: true,
          templateStatusChangedToProducer: true,
          agreementSuspendedUnsuspendedToConsumer: true,
          eserviceStateChangedToConsumer: true,
          agreementActivatedRejectedToConsumer: true,
          purposeActivatedRejectedToConsumer: true,
          purposeSuspendedUnsuspendedToConsumer: true,
          newEserviceTemplateVersionToInstantiator: true,
          eserviceTemplateNameChangedToInstantiator: true,
          eserviceTemplateStatusChangedToInstantiator: true,
          delegationApprovedRejectedToDelegator: true,
          eserviceNewVersionSubmittedToDelegator: true,
          eserviceNewVersionApprovedRejectedToDelegate: true,
          delegationSubmittedRevokedToDelegate: true,
          certifiedVerifiedAttributeAssignedRevokedToAssignee: true,
          clientKeyAddedDeletedToClientUsers: true,
          producerKeychainKeyAddedDeletedToClientUsers: true,
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
      await handleMessageV2(message, notificationConfigReadModelWriteService);

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
      await handleMessageV2(message, notificationConfigReadModelWriteService);

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
      await handleMessageV2(message, notificationConfigReadModelWriteService);

      const retrievedConfig =
        await notificationConfigReadModelService.getUserNotificationConfigByUserIdAndTenantId(
          userNotificationConfig.userId,
          userNotificationConfig.tenantId
        );

      expect(retrievedConfig).toBeUndefined();
    });
  });
});
