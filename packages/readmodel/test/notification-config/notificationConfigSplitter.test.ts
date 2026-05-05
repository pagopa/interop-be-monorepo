/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { generateMock } from "@anatine/zod-mock";
import {
  TenantNotificationConfigSQL,
  UserEnabledInAppNotificationSQL,
  UserEnabledEmailNotificationSQL,
  UserNotificationConfigSQL,
} from "pagopa-interop-readmodel-models";
import {
  getMockTenantNotificationConfig,
  getMockUserNotificationConfig,
} from "pagopa-interop-commons-test";
import {
  splitTenantNotificationConfigIntoObjectsSQL,
  splitUserNotificationConfigIntoObjectsSQL,
} from "../../src/notification-config/splitters.js";

describe("Notification config splitters", () => {
  const updatedAt = generateMock(z.coerce.date());

  it.each([
    ["", updatedAt, updatedAt.toISOString()],
    [" (converting undefined to null)", undefined, null],
  ])(
    "splitTenantNotificationConfigIntoObjectsSQL should convert a TenantNotificationConfig into a TenantNotificationConfig SQL object%s",
    (_, updatedAt, expectedUpdatedAt) => {
      const tenantNotificationConfig = {
        ...getMockTenantNotificationConfig(),
        updatedAt,
      };
      const tenantNotificationConfigSQL =
        splitTenantNotificationConfigIntoObjectsSQL(
          tenantNotificationConfig,
          1
        );

      const expectedTenantNotificationConfigSQL: TenantNotificationConfigSQL = {
        id: tenantNotificationConfig.id,
        tenantId: tenantNotificationConfig.tenantId,
        metadataVersion: 1,
        enabled: tenantNotificationConfig.enabled,
        createdAt: tenantNotificationConfig.createdAt.toISOString(),
        updatedAt: expectedUpdatedAt,
      };

      expect(tenantNotificationConfigSQL).toStrictEqual(
        expectedTenantNotificationConfigSQL
      );
    }
  );

  it.each([
    ["", updatedAt, updatedAt.toISOString()],
    [" (converting undefined to null)", undefined, null],
  ])(
    "splitUserNotificationConfigIntoObjectsSQL should convert a UserNotificationConfig into a UserNotificationConfig SQL object%s",
    (_, updatedAt, expectedUpdatedAt) => {
      const userNotificationConfig = {
        ...getMockUserNotificationConfig(),
        updatedAt,
      };
      const {
        userNotificationConfigSQL,
        enabledInAppNotificationsSQL,
        enabledEmailNotificationsSQL,
      } = splitUserNotificationConfigIntoObjectsSQL(userNotificationConfig, 1);

      const expectedUserNotificationConfigSQL: UserNotificationConfigSQL = {
        id: userNotificationConfig.id,
        userId: userNotificationConfig.userId,
        tenantId: userNotificationConfig.tenantId,
        userRoles: userNotificationConfig.userRoles,
        metadataVersion: 1,
        createdAt: userNotificationConfig.createdAt.toISOString(),
        updatedAt: expectedUpdatedAt,
        inAppNotificationPreference:
          userNotificationConfig.inAppNotificationPreference,
        emailNotificationPreference:
          userNotificationConfig.emailNotificationPreference,
        emailDigestPreference: userNotificationConfig.emailDigestPreference,
      };

      const expectedEnabledInAppNotificationsSQL: UserEnabledInAppNotificationSQL[] =
        (
          [
            "agreementSuspendedUnsuspendedToProducer",
            "agreementManagementToProducer",
            "clientAddedRemovedToProducer",
            "purposeStatusChangedToProducer",
            "templateStatusChangedToProducer",
            "agreementSuspendedUnsuspendedToConsumer",
            "eserviceStateChangedToConsumer",
            "agreementActivatedRejectedToConsumer",
            "purposeActivatedRejectedToConsumer",
            "purposeSuspendedUnsuspendedToConsumer",
            "newEserviceTemplateVersionToInstantiator",
            "eserviceTemplateNameChangedToInstantiator",
            "eserviceTemplateStatusChangedToInstantiator",
            "delegationApprovedRejectedToDelegator",
            "eserviceNewVersionSubmittedToDelegator",
            "eserviceNewVersionApprovedRejectedToDelegate",
            "delegationSubmittedRevokedToDelegate",
            "certifiedVerifiedAttributeAssignedRevokedToAssignee",
            "clientKeyAddedDeletedToClientUsers",
            "clientKeyConsumerAddedDeletedToClientUsers",
            "producerKeychainKeyAddedDeletedToClientUsers",
            "purposeQuotaAdjustmentRequestToProducer",
            "purposeOverQuotaStateToConsumer",
          ] as const
        )
          .filter(
            (notificationType) =>
              userNotificationConfig.inAppConfig[notificationType]
          )
          .map((notificationType) => ({
            userNotificationConfigId: userNotificationConfig.id,
            metadataVersion: 1,
            notificationType,
          }));
      const expectedEnabledEmailNotificationsSQL: UserEnabledEmailNotificationSQL[] =
        (
          [
            "agreementSuspendedUnsuspendedToProducer",
            "agreementManagementToProducer",
            "clientAddedRemovedToProducer",
            "purposeStatusChangedToProducer",
            "templateStatusChangedToProducer",
            "agreementSuspendedUnsuspendedToConsumer",
            "eserviceStateChangedToConsumer",
            "agreementActivatedRejectedToConsumer",
            "purposeActivatedRejectedToConsumer",
            "purposeSuspendedUnsuspendedToConsumer",
            "newEserviceTemplateVersionToInstantiator",
            "eserviceTemplateNameChangedToInstantiator",
            "eserviceTemplateStatusChangedToInstantiator",
            "delegationApprovedRejectedToDelegator",
            "eserviceNewVersionSubmittedToDelegator",
            "eserviceNewVersionApprovedRejectedToDelegate",
            "delegationSubmittedRevokedToDelegate",
            "certifiedVerifiedAttributeAssignedRevokedToAssignee",
            "clientKeyAddedDeletedToClientUsers",
            "clientKeyConsumerAddedDeletedToClientUsers",
            "producerKeychainKeyAddedDeletedToClientUsers",
            "purposeQuotaAdjustmentRequestToProducer",
            "purposeOverQuotaStateToConsumer",
          ] as const
        )
          .filter(
            (notificationType) =>
              userNotificationConfig.emailConfig[notificationType]
          )
          .map((notificationType) => ({
            userNotificationConfigId: userNotificationConfig.id,
            metadataVersion: 1,
            notificationType,
          }));

      expect(userNotificationConfigSQL).toStrictEqual(
        expectedUserNotificationConfigSQL
      );
      expect(enabledInAppNotificationsSQL).toStrictEqual(
        expectedEnabledInAppNotificationsSQL
      );
      expect(enabledEmailNotificationsSQL).toStrictEqual(
        expectedEnabledEmailNotificationsSQL
      );
    }
  );
});
