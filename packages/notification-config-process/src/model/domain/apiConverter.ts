import { notificationConfigApi } from "pagopa-interop-api-clients";
import {
  TenantNotificationConfig,
  UserNotificationConfig,
} from "pagopa-interop-models";

export function tenantNotificationConfigToApiTenantNotificationConfig({
  id,
  tenantId,
  config: {
    newEServiceVersionPublishedToConsumer,
    agreementSuspendedUnsuspendedToProducer,
    agreementSuspendedUnsuspendedToConsumer,
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
      newEServiceVersionPublishedToConsumer,
      agreementSuspendedUnsuspendedToProducer,
      agreementSuspendedUnsuspendedToConsumer,
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
    newEServiceVersionPublishedToConsumer: newEServiceVersionPublishedInApp,
    agreementSuspendedUnsuspendedToProducer:
      agreementSuspendedUnsuspendedToProducerInApp,
    agreementSuspendedUnsuspendedToConsumer:
      agreementSuspendedUnsuspendedToConsumerInApp,
    ...inAppRest
  },
  emailConfig: {
    newEServiceVersionPublishedToConsumer: newEServiceVersionPublishedEmail,
    agreementSuspendedUnsuspendedToProducer:
      agreementSuspendedUnsuspendedToProducerEmail,
    agreementSuspendedUnsuspendedToConsumer:
      agreementSuspendedUnsuspendedToConsumerEmail,
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
      newEServiceVersionPublishedToConsumer: newEServiceVersionPublishedInApp,
      agreementSuspendedUnsuspendedToProducer:
        agreementSuspendedUnsuspendedToProducerInApp,
      agreementSuspendedUnsuspendedToConsumer:
        agreementSuspendedUnsuspendedToConsumerInApp,
    },
    emailConfig: {
      newEServiceVersionPublishedToConsumer: newEServiceVersionPublishedEmail,
      agreementSuspendedUnsuspendedToProducer:
        agreementSuspendedUnsuspendedToProducerEmail,
      agreementSuspendedUnsuspendedToConsumer:
        agreementSuspendedUnsuspendedToConsumerEmail,
    },
    createdAt: createdAt.toJSON(),
    updatedAt: updatedAt?.toJSON(),
  };
}
