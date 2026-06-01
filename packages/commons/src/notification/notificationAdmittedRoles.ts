import {
  NotificationConfig,
  NotificationType,
  UserRole,
} from "pagopa-interop-models";
import { authRole } from "../auth/authorization.js";

const { ADMIN_ROLE, API_ROLE, SECURITY_ROLE, SUPPORT_ROLE, REVIEWER_ROLE, VIEWER_ROLE } =
  authRole;

export const notificationAdmittedRoles = {
  agreementSuspendedUnsuspendedToProducer: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: false,
    [SUPPORT_ROLE]: false,
    [REVIEWER_ROLE]: false,
    [VIEWER_ROLE]: false,
  },
  agreementManagementToProducer: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: false,
    [SUPPORT_ROLE]: false,
    [REVIEWER_ROLE]: false,
    [VIEWER_ROLE]: false,
  },
  clientAddedRemovedToProducer: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: true,
    [SECURITY_ROLE]: false,
    [SUPPORT_ROLE]: false,
    [REVIEWER_ROLE]: false,
    [VIEWER_ROLE]: false,
  },
  purposeStatusChangedToProducer: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: true,
    [SECURITY_ROLE]: false,
    [SUPPORT_ROLE]: false,
    [REVIEWER_ROLE]: false,
    [VIEWER_ROLE]: false,
  },
  templateStatusChangedToProducer: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: true,
    [SECURITY_ROLE]: false,
    [SUPPORT_ROLE]: false,
    [REVIEWER_ROLE]: false,
    [VIEWER_ROLE]: false,
  },
  agreementSuspendedUnsuspendedToConsumer: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: true,
    [SUPPORT_ROLE]: false,
    [REVIEWER_ROLE]: false,
    [VIEWER_ROLE]: false,
  },
  eserviceStateChangedToConsumer: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: true,
    [SUPPORT_ROLE]: false,
    [REVIEWER_ROLE]: false,
    [VIEWER_ROLE]: false,
  },
  agreementActivatedRejectedToConsumer: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: false,
    [SUPPORT_ROLE]: false,
    [REVIEWER_ROLE]: false,
    [VIEWER_ROLE]: false,
  },
  purposeActivatedRejectedToConsumer: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: false,
    [SUPPORT_ROLE]: false,
    [REVIEWER_ROLE]: false,
    [VIEWER_ROLE]: false,
  },
  purposeSuspendedUnsuspendedToConsumer: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: true,
    [SUPPORT_ROLE]: false,
    [REVIEWER_ROLE]: false,
    [VIEWER_ROLE]: false,
  },
  newEserviceTemplateVersionToInstantiator: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: false,
    [SUPPORT_ROLE]: false,
    [REVIEWER_ROLE]: false,
    [VIEWER_ROLE]: false,
  },
  eserviceTemplateNameChangedToInstantiator: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: false,
    [SUPPORT_ROLE]: false,
    [REVIEWER_ROLE]: false,
    [VIEWER_ROLE]: false,
  },
  eserviceTemplateStatusChangedToInstantiator: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: false,
    [SUPPORT_ROLE]: false,
    [REVIEWER_ROLE]: false,
    [VIEWER_ROLE]: false,
  },
  delegationApprovedRejectedToDelegator: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: false,
    [SUPPORT_ROLE]: false,
    [REVIEWER_ROLE]: false,
    [VIEWER_ROLE]: false,
  },
  eserviceNewVersionSubmittedToDelegator: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: false,
    [SUPPORT_ROLE]: false,
    [REVIEWER_ROLE]: false,
    [VIEWER_ROLE]: false,
  },
  eserviceNewVersionApprovedRejectedToDelegate: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: false,
    [SUPPORT_ROLE]: false,
    [REVIEWER_ROLE]: false,
    [VIEWER_ROLE]: false,
  },
  delegationSubmittedRevokedToDelegate: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: false,
    [SUPPORT_ROLE]: false,
    [REVIEWER_ROLE]: false,
    [VIEWER_ROLE]: false,
  },
  certifiedVerifiedAttributeAssignedRevokedToAssignee: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: false,
    [SUPPORT_ROLE]: false,
    [REVIEWER_ROLE]: false,
    [VIEWER_ROLE]: false,
  },
  clientKeyAddedDeletedToClientUsers: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: true,
    [SUPPORT_ROLE]: false,
    [REVIEWER_ROLE]: false,
    [VIEWER_ROLE]: false,
  },
  clientKeyConsumerAddedDeletedToClientUsers: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: true,
    [SUPPORT_ROLE]: false,
    [REVIEWER_ROLE]: false,
    [VIEWER_ROLE]: false,
  },
  producerKeychainKeyAddedDeletedToClientUsers: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: true,
    [SUPPORT_ROLE]: false,
    [REVIEWER_ROLE]: false,
    [VIEWER_ROLE]: false,
  },
  purposeQuotaAdjustmentRequestToProducer: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: true,
    [SUPPORT_ROLE]: false,
    [REVIEWER_ROLE]: false,
    [VIEWER_ROLE]: false,
  },
  purposeOverQuotaStateToConsumer: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: true,
    [SUPPORT_ROLE]: false,
    [REVIEWER_ROLE]: false,
    [VIEWER_ROLE]: false,
  },
} as const satisfies Record<NotificationType, Record<UserRole, boolean>> &
  Record<NotificationType, Record<typeof SUPPORT_ROLE, false>> & // To ensure that SUPPORT_ROLE cannot receive any notification
  Record<NotificationType, Record<typeof REVIEWER_ROLE, false>> & // To ensure that REVIEWER_ROLE cannot receive any notification
  Record<NotificationType, Record<typeof VIEWER_ROLE, false>>; // To ensure that VIEWER_ROLE cannot receive any notification

export const isNotificationConfigAllowedForUserRoles = (
  notificationConfig: NotificationConfig,
  userRoles: UserRole[]
): boolean =>
  (Object.keys(notificationConfig) as NotificationType[]).every(
    (notificationType) =>
      !notificationConfig[notificationType] ||
      userRoles.some(
        (role) => notificationAdmittedRoles[notificationType][role]
      )
  );

export const overrideNotificationConfigByAdmittedRoles = (
  userRoles: UserRole[]
): ((c: NotificationConfig) => NotificationConfig) =>
  mapNotificationConfig((notificationType, currentValue) =>
    userRoles.some((role) => notificationAdmittedRoles[notificationType][role])
      ? currentValue
      : false
  );

export const mapNotificationConfig =
  (f: (notificationType: NotificationType, currentValue: boolean) => boolean) =>
  (c: NotificationConfig): NotificationConfig => {
    const keys = Object.keys(NotificationConfig.shape) as NotificationType[];
    const entries: Array<[NotificationType, boolean]> = keys.map((key) => [
      key,
      f(key, c[key]),
    ]);
    return Object.fromEntries(entries) as NotificationConfig;
  };
