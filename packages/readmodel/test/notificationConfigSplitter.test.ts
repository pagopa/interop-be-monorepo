/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { generateMock } from "@anatine/zod-mock";
import {
  TenantEnabledNotificationSQL,
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
} from "../src/notification-config/splitters.js";

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
      const { tenantNotificationConfigSQL, enabledNotificationsSQL } =
        splitTenantNotificationConfigIntoObjectsSQL(
          tenantNotificationConfig,
          1
        );

      const expectedTenantNotificationConfigSQL: TenantNotificationConfigSQL = {
        id: tenantNotificationConfig.id,
        tenantId: tenantNotificationConfig.tenantId,
        metadataVersion: 1,
        createdAt: tenantNotificationConfig.createdAt.toISOString(),
        updatedAt: expectedUpdatedAt,
      };

      const expectedEnabledNotificationsSQL: TenantEnabledNotificationSQL[] = (
        [
          "agreementSuspendedUnsuspendedToProducer",
          "agreementManagementToProducer",
          "clientAddedRemovedToProducer",
          "purposeStatusChangedToProducer",
          "templateStatusChangedToProducer",
          "agreementSuspendedUnsuspendedToConsumer",
          "eserviceStateChangedToConsumer",
          "agreementActivatedRejectedToConsumer",
          "purposeVersionOverQuotaToConsumer",
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
        ] as const
      )
        .filter(
          (notificationType) =>
            tenantNotificationConfig.config[notificationType]
        )
        .map((notificationType) => ({
          tenantNotificationConfigId: tenantNotificationConfig.id,
          metadataVersion: 1,
          notificationType,
        }));

      expect(tenantNotificationConfigSQL).toStrictEqual(
        expectedTenantNotificationConfigSQL
      );
      expect(enabledNotificationsSQL).toStrictEqual(
        expectedEnabledNotificationsSQL
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
        metadataVersion: 1,
        createdAt: userNotificationConfig.createdAt.toISOString(),
        updatedAt: expectedUpdatedAt,
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
            "purposeVersionOverQuotaToConsumer",
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
            "purposeVersionOverQuotaToConsumer",
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
