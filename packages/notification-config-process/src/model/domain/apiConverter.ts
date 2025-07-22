import { notificationConfigApi } from "pagopa-interop-api-clients";
import {
  TenantNotificationConfig,
  UserNotificationConfig,
} from "pagopa-interop-models";

export function tenantNotificationConfigToApiTenantNotificationConfig({
  id,
  tenantId,
  config: {
    newEServiceVersionPublished,
    productionAgreementSuspendedUnsuspended,
    consumptionAgreementSuspendedUnsuspended,
    ...rest
  },
  createdAt,
  updatedAt,
}: TenantNotificationConfig): notificationConfigApi.TenantNotificationConfig {
  void (rest satisfies Record<string, never>);
  return {
    id,
    tenantId,
    config: {
      newEServiceVersionPublished,
      productionAgreementSuspendedUnsuspended,
      consumptionAgreementSuspendedUnsuspended,
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
    newEServiceVersionPublished: newEServiceVersionPublishedInApp,
    productionAgreementSuspendedUnsuspended:
      productionAgreementSuspendedUnsuspendedInApp,
    consumptionAgreementSuspendedUnsuspended:
      consumptionAgreementSuspendedUnsuspendedInApp,
    ...inAppRest
  },
  emailConfig: {
    newEServiceVersionPublished: newEServiceVersionPublishedEmail,
    productionAgreementSuspendedUnsuspended:
      productionAgreementSuspendedUnsuspendedEmail,
    consumptionAgreementSuspendedUnsuspended:
      consumptionAgreementSuspendedUnsuspendedEmail,
    ...emailRest
  },
  createdAt,
  updatedAt,
}: UserNotificationConfig): notificationConfigApi.UserNotificationConfig {
  void (inAppRest satisfies Record<string, never>);
  void (emailRest satisfies Record<string, never>);
  return {
    id,
    userId,
    tenantId,
    inAppConfig: {
      newEServiceVersionPublished: newEServiceVersionPublishedInApp,
      productionAgreementSuspendedUnsuspended:
        productionAgreementSuspendedUnsuspendedInApp,
      consumptionAgreementSuspendedUnsuspended:
        consumptionAgreementSuspendedUnsuspendedInApp,
    },
    emailConfig: {
      newEServiceVersionPublished: newEServiceVersionPublishedEmail,
      productionAgreementSuspendedUnsuspended:
        productionAgreementSuspendedUnsuspendedEmail,
      consumptionAgreementSuspendedUnsuspended:
        consumptionAgreementSuspendedUnsuspendedEmail,
    },
    createdAt: createdAt.toJSON(),
    updatedAt: updatedAt?.toJSON(),
  };
}
