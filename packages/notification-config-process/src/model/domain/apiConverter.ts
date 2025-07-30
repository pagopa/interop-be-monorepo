import { notificationConfigApi } from "pagopa-interop-api-clients";
import {
  TenantNotificationConfig,
  UserNotificationConfig,
} from "pagopa-interop-models";

export function tenantNotificationConfigToApiTenantNotificationConfig({
  id,
  tenantId,
  config: {
    agreementSuspendedUnsuspendedToProducer,
    agreementManagementToProducer,
    clientAddedRemovedToProducer,
    purposeStatusChangedToProducer,
    templateStatusChangedToProducer,
    agreementSuspendedUnsuspendedToConsumer,
    eserviceStatusChangedToConsumer,
    agreementActivatedRejectedToConsumer,
    purposeVersionOverQuotaToConsumer,
    purposeActivatedRejectedToConsumer,
    purposeSuspendedUnsuspendedToConsumer,
    newEserviceTemplateVersionToInstatiator,
    eserviceTemplateNameChangedToInstatiator,
    eserviceTemplateStatusChangedToInstantiator,
    delegationApprovedRejectedToDelegator,
    eserviceNewVersionSubmittedToDelegator,
    eserviceNewVersionApprovedRejectedToDelegate,
    delegationSubmittedRevokedToDelegate,
    certifiedVerifiedAttributeAssignedRevokedToAssignee,
    clientKeyStatusChangedToClientUsers,
  },
  createdAt,
  updatedAt,
}: TenantNotificationConfig): notificationConfigApi.TenantNotificationConfig {
  // No need for rest assertion as we're explicitly destructuring all fields
  return {
    id,
    tenantId,
    config: {
      agreementSuspendedUnsuspendedToProducer,
      agreementManagementToProducer,
      clientAddedRemovedToProducer,
      purposeStatusChangedToProducer,
      templateStatusChangedToProducer,
      agreementSuspendedUnsuspendedToConsumer,
      eserviceStatusChangedToConsumer,
      agreementActivatedRejectedToConsumer,
      purposeVersionOverQuotaToConsumer,
      purposeActivatedRejectedToConsumer,
      purposeSuspendedUnsuspendedToConsumer,
      newEserviceTemplateVersionToInstatiator,
      eserviceTemplateNameChangedToInstatiator,
      eserviceTemplateStatusChangedToInstantiator,
      delegationApprovedRejectedToDelegator,
      eserviceNewVersionSubmittedToDelegator,
      eserviceNewVersionApprovedRejectedToDelegate,
      delegationSubmittedRevokedToDelegate,
      certifiedVerifiedAttributeAssignedRevokedToAssignee,
      clientKeyStatusChangedToClientUsers,
    },
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
    eserviceStatusChangedToConsumer: eserviceStatusChangedToConsumerInApp,
    agreementActivatedRejectedToConsumer:
      agreementActivatedRejectedToConsumerInApp,
    purposeVersionOverQuotaToConsumer: purposeVersionOverQuotaToConsumerInApp,
    purposeActivatedRejectedToConsumer: purposeActivatedRejectedToConsumerInApp,
    purposeSuspendedUnsuspendedToConsumer:
      purposeSuspendedUnsuspendedToConsumerInApp,
    newEserviceTemplateVersionToInstatiator:
      newEserviceTemplateVersionToInstatiatorInApp,
    eserviceTemplateNameChangedToInstatiator:
      eserviceTemplateNameChangedToInstatiatorInApp,
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
    clientKeyStatusChangedToClientUsers:
      clientKeyStatusChangedToClientUsersInApp,
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
    eserviceStatusChangedToConsumer: eserviceStatusChangedToConsumerEmail,
    agreementActivatedRejectedToConsumer:
      agreementActivatedRejectedToConsumerEmail,
    purposeVersionOverQuotaToConsumer: purposeVersionOverQuotaToConsumerEmail,
    purposeActivatedRejectedToConsumer: purposeActivatedRejectedToConsumerEmail,
    purposeSuspendedUnsuspendedToConsumer:
      purposeSuspendedUnsuspendedToConsumerEmail,
    newEserviceTemplateVersionToInstatiator:
      newEserviceTemplateVersionToInstatiatorEmail,
    eserviceTemplateNameChangedToInstatiator:
      eserviceTemplateNameChangedToInstatiatorEmail,
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
    clientKeyStatusChangedToClientUsers:
      clientKeyStatusChangedToClientUsersEmail,
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
      eserviceStatusChangedToConsumer: eserviceStatusChangedToConsumerInApp,
      agreementActivatedRejectedToConsumer:
        agreementActivatedRejectedToConsumerInApp,
      purposeVersionOverQuotaToConsumer: purposeVersionOverQuotaToConsumerInApp,
      purposeActivatedRejectedToConsumer:
        purposeActivatedRejectedToConsumerInApp,
      purposeSuspendedUnsuspendedToConsumer:
        purposeSuspendedUnsuspendedToConsumerInApp,
      newEserviceTemplateVersionToInstatiator:
        newEserviceTemplateVersionToInstatiatorInApp,
      eserviceTemplateNameChangedToInstatiator:
        eserviceTemplateNameChangedToInstatiatorInApp,
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
      clientKeyStatusChangedToClientUsers:
        clientKeyStatusChangedToClientUsersInApp,
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
      eserviceStatusChangedToConsumer: eserviceStatusChangedToConsumerEmail,
      agreementActivatedRejectedToConsumer:
        agreementActivatedRejectedToConsumerEmail,
      purposeVersionOverQuotaToConsumer: purposeVersionOverQuotaToConsumerEmail,
      purposeActivatedRejectedToConsumer:
        purposeActivatedRejectedToConsumerEmail,
      purposeSuspendedUnsuspendedToConsumer:
        purposeSuspendedUnsuspendedToConsumerEmail,
      newEserviceTemplateVersionToInstatiator:
        newEserviceTemplateVersionToInstatiatorEmail,
      eserviceTemplateNameChangedToInstatiator:
        eserviceTemplateNameChangedToInstatiatorEmail,
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
      clientKeyStatusChangedToClientUsers:
        clientKeyStatusChangedToClientUsersEmail,
    },
    createdAt: createdAt.toJSON(),
    updatedAt: updatedAt?.toJSON(),
  };
}
