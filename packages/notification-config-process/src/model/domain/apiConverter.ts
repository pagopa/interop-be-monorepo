import { notificationConfigApi } from "pagopa-interop-api-clients";
import {
  TenantNotificationConfig,
  UserNotificationConfig,
} from "pagopa-interop-models";

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
    purposeVersionOverQuotaToConsumer: purposeVersionOverQuotaToConsumerInApp,
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
    purposeVersionOverQuotaToConsumer: purposeVersionOverQuotaToConsumerEmail,
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
  },
  createdAt,
  updatedAt,
}: UserNotificationConfig): notificationConfigApi.UserNotificationConfig {
  // No need for rest assertion as we're explicitly destructuring all fields
  return {
    id,
    userId,
    tenantId,
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
      purposeVersionOverQuotaToConsumer: purposeVersionOverQuotaToConsumerInApp,
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
      purposeVersionOverQuotaToConsumer: purposeVersionOverQuotaToConsumerEmail,
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
    },
    createdAt: createdAt.toJSON(),
    updatedAt: updatedAt?.toJSON(),
  };
}
