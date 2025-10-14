import { notificationConfigApi } from "pagopa-interop-api-clients";
import {
  EmailNotificationPreference,
  TenantNotificationConfig,
  UserNotificationConfig,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

export function tenantNotificationConfigToApiTenantNotificationConfig({
  id,
  tenantId,
  enabled,
  createdAt,
  updatedAt,
}: TenantNotificationConfig): notificationConfigApi.TenantNotificationConfig {
  return {
    id,
    tenantId,
    enabled,
    createdAt: createdAt.toJSON(),
    updatedAt: updatedAt?.toJSON(),
  };
}

export function userNotificationConfigToApiUserNotificationConfig({
  id,
  userId,
  tenantId,
  inAppNotificationPreference,
  emailNotificationPreference,
  inAppConfig: {
    agreementSuspendedUnsuspendedToProducer:
      agreementSuspendedUnsuspendedToProducerInApp,
    agreementManagementToProducer: agreementManagementToProducerInApp,
    clientAddedRemovedToProducer: clientAddedRemovedToProducerInApp,
    purposeStatusChangedToProducer: purposeStatusChangedToProducerInApp,
    templateStatusChangedToProducer: templateStatusChangedToProducerInApp,
    agreementSuspendedUnsuspendedToConsumer:
      agreementSuspendedUnsuspendedToConsumerInApp,
    eserviceStateChangedToConsumer: eserviceStateChangedToConsumerInApp,
    agreementActivatedRejectedToConsumer:
      agreementActivatedRejectedToConsumerInApp,
    purposeActivatedRejectedToConsumer: purposeActivatedRejectedToConsumerInApp,
    purposeSuspendedUnsuspendedToConsumer:
      purposeSuspendedUnsuspendedToConsumerInApp,
    newEserviceTemplateVersionToInstantiator:
      newEserviceTemplateVersionToInstantiatorInApp,
    eserviceTemplateNameChangedToInstantiator:
      eserviceTemplateNameChangedToInstantiatorInApp,
    eserviceTemplateStatusChangedToInstantiator:
      eserviceTemplateStatusChangedToInstantiatorInApp,
    delegationApprovedRejectedToDelegator:
      delegationApprovedRejectedToDelegatorInApp,
    eserviceNewVersionSubmittedToDelegator:
      eserviceNewVersionSubmittedToDelegatorInApp,
    eserviceNewVersionApprovedRejectedToDelegate:
      eserviceNewVersionApprovedRejectedToDelegateInApp,
    delegationSubmittedRevokedToDelegate:
      delegationSubmittedRevokedToDelegateInApp,
    certifiedVerifiedAttributeAssignedRevokedToAssignee:
      certifiedVerifiedAttributeAssignedRevokedToAssigneeInApp,
    clientKeyAddedDeletedToClientUsers: clientKeyAddedDeletedToClientUsersInApp,
    producerKeychainKeyAddedDeletedToClientUsers:
      producerKeychainKeyAddedDeletedToClientUsersInApp,
  },
  emailConfig: {
    agreementSuspendedUnsuspendedToProducer:
      agreementSuspendedUnsuspendedToProducerEmail,
    agreementManagementToProducer: agreementManagementToProducerEmail,
    clientAddedRemovedToProducer: clientAddedRemovedToProducerEmail,
    purposeStatusChangedToProducer: purposeStatusChangedToProducerEmail,
    templateStatusChangedToProducer: templateStatusChangedToProducerEmail,
    agreementSuspendedUnsuspendedToConsumer:
      agreementSuspendedUnsuspendedToConsumerEmail,
    eserviceStateChangedToConsumer: eserviceStateChangedToConsumerEmail,
    agreementActivatedRejectedToConsumer:
      agreementActivatedRejectedToConsumerEmail,
    purposeActivatedRejectedToConsumer: purposeActivatedRejectedToConsumerEmail,
    purposeSuspendedUnsuspendedToConsumer:
      purposeSuspendedUnsuspendedToConsumerEmail,
    newEserviceTemplateVersionToInstantiator:
      newEserviceTemplateVersionToInstantiatorEmail,
    eserviceTemplateNameChangedToInstantiator:
      eserviceTemplateNameChangedToInstantiatorEmail,
    eserviceTemplateStatusChangedToInstantiator:
      eserviceTemplateStatusChangedToInstantiatorEmail,
    delegationApprovedRejectedToDelegator:
      delegationApprovedRejectedToDelegatorEmail,
    eserviceNewVersionSubmittedToDelegator:
      eserviceNewVersionSubmittedToDelegatorEmail,
    eserviceNewVersionApprovedRejectedToDelegate:
      eserviceNewVersionApprovedRejectedToDelegateEmail,
    delegationSubmittedRevokedToDelegate:
      delegationSubmittedRevokedToDelegateEmail,
    certifiedVerifiedAttributeAssignedRevokedToAssignee:
      certifiedVerifiedAttributeAssignedRevokedToAssigneeEmail,
    clientKeyAddedDeletedToClientUsers: clientKeyAddedDeletedToClientUsersEmail,
    producerKeychainKeyAddedDeletedToClientUsers:
      producerKeychainKeyAddedDeletedToClientUsersEmail,
  },
  createdAt,
  updatedAt,
}: UserNotificationConfig): notificationConfigApi.UserNotificationConfig {
  // No need for rest assertion as we're explicitly destructuring all fields
  return {
    id,
    userId,
    tenantId,
    inAppNotificationPreference,
    emailNotificationPreference:
      emailNotificationPreferenceToApiEmailNotificationPreference(
        emailNotificationPreference
      ),
    inAppConfig: {
      agreementSuspendedUnsuspendedToProducer:
        agreementSuspendedUnsuspendedToProducerInApp,
      agreementManagementToProducer: agreementManagementToProducerInApp,
      clientAddedRemovedToProducer: clientAddedRemovedToProducerInApp,
      purposeStatusChangedToProducer: purposeStatusChangedToProducerInApp,
      templateStatusChangedToProducer: templateStatusChangedToProducerInApp,
      agreementSuspendedUnsuspendedToConsumer:
        agreementSuspendedUnsuspendedToConsumerInApp,
      eserviceStateChangedToConsumer: eserviceStateChangedToConsumerInApp,
      agreementActivatedRejectedToConsumer:
        agreementActivatedRejectedToConsumerInApp,
      purposeActivatedRejectedToConsumer:
        purposeActivatedRejectedToConsumerInApp,
      purposeSuspendedUnsuspendedToConsumer:
        purposeSuspendedUnsuspendedToConsumerInApp,
      newEserviceTemplateVersionToInstantiator:
        newEserviceTemplateVersionToInstantiatorInApp,
      eserviceTemplateNameChangedToInstantiator:
        eserviceTemplateNameChangedToInstantiatorInApp,
      eserviceTemplateStatusChangedToInstantiator:
        eserviceTemplateStatusChangedToInstantiatorInApp,
      delegationApprovedRejectedToDelegator:
        delegationApprovedRejectedToDelegatorInApp,
      eserviceNewVersionSubmittedToDelegator:
        eserviceNewVersionSubmittedToDelegatorInApp,
      eserviceNewVersionApprovedRejectedToDelegate:
        eserviceNewVersionApprovedRejectedToDelegateInApp,
      delegationSubmittedRevokedToDelegate:
        delegationSubmittedRevokedToDelegateInApp,
      certifiedVerifiedAttributeAssignedRevokedToAssignee:
        certifiedVerifiedAttributeAssignedRevokedToAssigneeInApp,
      clientKeyAddedDeletedToClientUsers:
        clientKeyAddedDeletedToClientUsersInApp,
      producerKeychainKeyAddedDeletedToClientUsers:
        producerKeychainKeyAddedDeletedToClientUsersInApp,
    },
    emailConfig: {
      agreementSuspendedUnsuspendedToProducer:
        agreementSuspendedUnsuspendedToProducerEmail,
      agreementManagementToProducer: agreementManagementToProducerEmail,
      clientAddedRemovedToProducer: clientAddedRemovedToProducerEmail,
      purposeStatusChangedToProducer: purposeStatusChangedToProducerEmail,
      templateStatusChangedToProducer: templateStatusChangedToProducerEmail,
      agreementSuspendedUnsuspendedToConsumer:
        agreementSuspendedUnsuspendedToConsumerEmail,
      eserviceStateChangedToConsumer: eserviceStateChangedToConsumerEmail,
      agreementActivatedRejectedToConsumer:
        agreementActivatedRejectedToConsumerEmail,
      purposeActivatedRejectedToConsumer:
        purposeActivatedRejectedToConsumerEmail,
      purposeSuspendedUnsuspendedToConsumer:
        purposeSuspendedUnsuspendedToConsumerEmail,
      newEserviceTemplateVersionToInstantiator:
        newEserviceTemplateVersionToInstantiatorEmail,
      eserviceTemplateNameChangedToInstantiator:
        eserviceTemplateNameChangedToInstantiatorEmail,
      eserviceTemplateStatusChangedToInstantiator:
        eserviceTemplateStatusChangedToInstantiatorEmail,
      delegationApprovedRejectedToDelegator:
        delegationApprovedRejectedToDelegatorEmail,
      eserviceNewVersionSubmittedToDelegator:
        eserviceNewVersionSubmittedToDelegatorEmail,
      eserviceNewVersionApprovedRejectedToDelegate:
        eserviceNewVersionApprovedRejectedToDelegateEmail,
      delegationSubmittedRevokedToDelegate:
        delegationSubmittedRevokedToDelegateEmail,
      certifiedVerifiedAttributeAssignedRevokedToAssignee:
        certifiedVerifiedAttributeAssignedRevokedToAssigneeEmail,
      clientKeyAddedDeletedToClientUsers:
        clientKeyAddedDeletedToClientUsersEmail,
      producerKeychainKeyAddedDeletedToClientUsers:
        producerKeychainKeyAddedDeletedToClientUsersEmail,
    },
    createdAt: createdAt.toJSON(),
    updatedAt: updatedAt?.toJSON(),
  };
}

export function apiEmailNotificationPreferenceToEmailNotificationPreference(
  apiEmailNotificationPreference: notificationConfigApi.UserNotificationConfig["emailNotificationPreference"]
): EmailNotificationPreference {
  return match(apiEmailNotificationPreference)
    .with("ENABLED", () => "Enabled" as const)
    .with("DISABLED", () => "Disabled" as const)
    .with("DIGEST", () => "Digest" as const)
    .exhaustive();
}

export function emailNotificationPreferenceToApiEmailNotificationPreference(
  emailNotificationPreference: EmailNotificationPreference
): notificationConfigApi.UserNotificationConfig["emailNotificationPreference"] {
  return match(emailNotificationPreference)
    .with("Enabled", () => "ENABLED" as const)
    .with("Disabled", () => "DISABLED" as const)
    .with("Digest", () => "DIGEST" as const)
    .exhaustive();
}
