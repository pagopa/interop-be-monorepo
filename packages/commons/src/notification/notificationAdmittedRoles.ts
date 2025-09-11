import {
  NotificationConfig,
  NotificationType,
  UserRole,
} from "pagopa-interop-models";
import { authRole } from "../auth/authorization.js";

const { ADMIN_ROLE, API_ROLE, SECURITY_ROLE, SUPPORT_ROLE } = authRole;

type NotificationAllRoles = Extract<
  UserRole,
  typeof ADMIN_ROLE | typeof API_ROLE | typeof SECURITY_ROLE
>;

export const notificationAdmittedRoles = {
  agreementSuspendedUnsuspendedToProducer: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: false,
  },
  agreementManagementToProducer: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: false,
  },
  clientAddedRemovedToProducer: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: true,
    [SECURITY_ROLE]: false,
  },
  purposeStatusChangedToProducer: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: true,
    [SECURITY_ROLE]: false,
  },
  templateStatusChangedToProducer: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: true,
    [SECURITY_ROLE]: false,
  },
  agreementSuspendedUnsuspendedToConsumer: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: true,
  },
  eserviceStateChangedToConsumer: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: true,
  },
  agreementActivatedRejectedToConsumer: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: false,
  },
  purposeActivatedRejectedToConsumer: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: false,
  },
  purposeSuspendedUnsuspendedToConsumer: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: true,
  },
  newEserviceTemplateVersionToInstantiator: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: true,
  },
  eserviceTemplateNameChangedToInstantiator: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: true,
  },
  eserviceTemplateStatusChangedToInstantiator: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: true,
  },
  delegationApprovedRejectedToDelegator: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: false,
  },
  eserviceNewVersionSubmittedToDelegator: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: false,
  },
  eserviceNewVersionApprovedRejectedToDelegate: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: true,
    [SECURITY_ROLE]: false,
  },
  delegationSubmittedRevokedToDelegate: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: false,
  },
  certifiedVerifiedAttributeAssignedRevokedToAssignee: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: false,
  },
  clientKeyAddedDeletedToClientUsers: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: true,
  },
} as const satisfies Record<
  NotificationType,
  Record<NotificationAllRoles, boolean>
>;

export const overrideNotificationConfigByAdmittedRoles = (
  userRoles: UserRole[]
): ((c: NotificationConfig) => NotificationConfig) =>
  mapNotificationConfig((notificationType, currentValue) =>
    userRoles.some(
      (role) =>
        role !== SUPPORT_ROLE &&
        notificationAdmittedRoles[notificationType][role]
    )
      ? currentValue
      : false
  );

export const mapNotificationConfig =
  (f: (notificationType: NotificationType, currentValue: boolean) => boolean) =>
  (c: NotificationConfig): NotificationConfig => ({
    agreementSuspendedUnsuspendedToProducer: f(
      "agreementSuspendedUnsuspendedToProducer",
      c.agreementSuspendedUnsuspendedToProducer
    ),
    agreementManagementToProducer: f(
      "agreementManagementToProducer",
      c.agreementManagementToProducer
    ),
    clientAddedRemovedToProducer: f(
      "clientAddedRemovedToProducer",
      c.clientAddedRemovedToProducer
    ),
    purposeStatusChangedToProducer: f(
      "purposeStatusChangedToProducer",
      c.purposeStatusChangedToProducer
    ),
    templateStatusChangedToProducer: f(
      "templateStatusChangedToProducer",
      c.templateStatusChangedToProducer
    ),
    agreementSuspendedUnsuspendedToConsumer: f(
      "agreementSuspendedUnsuspendedToConsumer",
      c.agreementSuspendedUnsuspendedToConsumer
    ),
    eserviceStateChangedToConsumer: f(
      "eserviceStateChangedToConsumer",
      c.eserviceStateChangedToConsumer
    ),
    agreementActivatedRejectedToConsumer: f(
      "agreementActivatedRejectedToConsumer",
      c.agreementActivatedRejectedToConsumer
    ),
    purposeActivatedRejectedToConsumer: f(
      "purposeActivatedRejectedToConsumer",
      c.purposeActivatedRejectedToConsumer
    ),
    purposeSuspendedUnsuspendedToConsumer: f(
      "purposeSuspendedUnsuspendedToConsumer",
      c.purposeSuspendedUnsuspendedToConsumer
    ),
    newEserviceTemplateVersionToInstantiator: f(
      "newEserviceTemplateVersionToInstantiator",
      c.newEserviceTemplateVersionToInstantiator
    ),
    eserviceTemplateNameChangedToInstantiator: f(
      "eserviceTemplateNameChangedToInstantiator",
      c.eserviceTemplateNameChangedToInstantiator
    ),
    eserviceTemplateStatusChangedToInstantiator: f(
      "eserviceTemplateStatusChangedToInstantiator",
      c.eserviceTemplateStatusChangedToInstantiator
    ),
    delegationApprovedRejectedToDelegator: f(
      "delegationApprovedRejectedToDelegator",
      c.delegationApprovedRejectedToDelegator
    ),
    eserviceNewVersionSubmittedToDelegator: f(
      "eserviceNewVersionSubmittedToDelegator",
      c.eserviceNewVersionSubmittedToDelegator
    ),
    eserviceNewVersionApprovedRejectedToDelegate: f(
      "eserviceNewVersionApprovedRejectedToDelegate",
      c.eserviceNewVersionApprovedRejectedToDelegate
    ),
    delegationSubmittedRevokedToDelegate: f(
      "delegationSubmittedRevokedToDelegate",
      c.delegationSubmittedRevokedToDelegate
    ),
    certifiedVerifiedAttributeAssignedRevokedToAssignee: f(
      "certifiedVerifiedAttributeAssignedRevokedToAssignee",
      c.certifiedVerifiedAttributeAssignedRevokedToAssignee
    ),
    clientKeyAddedDeletedToClientUsers: f(
      "clientKeyAddedDeletedToClientUsers",
      c.clientKeyAddedDeletedToClientUsers
    ),
  });
