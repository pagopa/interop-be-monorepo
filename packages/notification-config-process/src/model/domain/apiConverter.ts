import { notificationConfigApi } from "pagopa-interop-api-clients";
import {
  TenantNotificationConfig,
  UserNotificationConfig,
  UserRole,
  userRole,
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
  userRoles,
  inAppNotificationPreference,
  emailNotificationPreference,
  emailDigestPreference,
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
    clientKeyConsumerAddedDeletedToClientUsers:
      clientKeyConsumerAddedDeletedToClientUsersInApp,
    producerKeychainKeyAddedDeletedToClientUsers:
      producerKeychainKeyAddedDeletedToClientUsersInApp,
    purposeQuotaAdjustmentRequestToProducer:
      purposeQuotaAdjustmentRequestToProducerInApp,
    purposeOverQuotaStateToConsumer: purposeOverQuotaStateToConsumerInApp,
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
    clientKeyConsumerAddedDeletedToClientUsers:
      clientKeyConsumerAddedDeletedToClientUsersEmail,
    producerKeychainKeyAddedDeletedToClientUsers:
      producerKeychainKeyAddedDeletedToClientUsersEmail,
    purposeQuotaAdjustmentRequestToProducer:
      purposeQuotaAdjustmentRequestToProducerEmail,
    purposeOverQuotaStateToConsumer: purposeOverQuotaStateToConsumerEmail,
  },
  createdAt,
  updatedAt,
}: UserNotificationConfig): notificationConfigApi.UserNotificationConfig {
  // No need for rest assertion as we're explicitly destructuring all fields
  return {
    id,
    userId,
    tenantId,
    userRoles: userRoles.map(userRoleToApiUserRole),
    inAppNotificationPreference,
    emailNotificationPreference,
    emailDigestPreference,
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
      clientKeyConsumerAddedDeletedToClientUsers:
        clientKeyConsumerAddedDeletedToClientUsersInApp,
      producerKeychainKeyAddedDeletedToClientUsers:
        producerKeychainKeyAddedDeletedToClientUsersInApp,
      purposeQuotaAdjustmentRequestToProducer:
        purposeQuotaAdjustmentRequestToProducerInApp,
      purposeOverQuotaStateToConsumer: purposeOverQuotaStateToConsumerInApp,
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
      clientKeyConsumerAddedDeletedToClientUsers:
        clientKeyConsumerAddedDeletedToClientUsersEmail,
      producerKeychainKeyAddedDeletedToClientUsers:
        producerKeychainKeyAddedDeletedToClientUsersEmail,
      purposeQuotaAdjustmentRequestToProducer:
        purposeQuotaAdjustmentRequestToProducerEmail,
      purposeOverQuotaStateToConsumer: purposeOverQuotaStateToConsumerEmail,
    },
    createdAt: createdAt.toJSON(),
    updatedAt: updatedAt?.toJSON(),
  };
}

export function apiUserRoleToUserRole(
  apiUserRole: notificationConfigApi.UserRole
): UserRole {
  return match(apiUserRole)
    .with("ADMIN", () => userRole.ADMIN_ROLE)
    .with("API", () => userRole.API_ROLE)
    .with("SECURITY", () => userRole.SECURITY_ROLE)
    .with("SUPPORT", () => userRole.SUPPORT_ROLE)
    .exhaustive();
}

export function userRoleToApiUserRole(
  role: UserRole
): notificationConfigApi.UserRole {
  return match(role)
    .with(userRole.ADMIN_ROLE, () => "ADMIN" as const)
    .with(userRole.API_ROLE, () => "API" as const)
    .with(userRole.SECURITY_ROLE, () => "SECURITY" as const)
    .with(userRole.SUPPORT_ROLE, () => "SUPPORT" as const)
    .exhaustive();
}
