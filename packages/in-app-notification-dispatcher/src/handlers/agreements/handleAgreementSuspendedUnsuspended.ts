import {
  AgreementV2,
  fromAgreementV2,
  NewNotification,
  missingKafkaMessageDataError,
  TenantId,
  UserId,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";
import {
  retrieveTenant,
  retrieveEservice,
  getNotificationRecipients,
} from "../handlerCommons.js";

export type AgreementSuspendedUnsuspendedEventType =
  | "AgreementSuspendedByConsumer"
  | "AgreementUnsuspendedByConsumer"
  | "AgreementSuspendedByProducer"
  | "AgreementUnsuspendedByProducer"
  | "AgreementSuspendedByPlatform"
  | "AgreementUnsuspendedByPlatform"
  | "AgreementArchivedByConsumer";

type NotificationAudience = "consumer" | "producer";
type NotificationType =
  | "agreementSuspendedUnsuspendedToConsumer"
  | "agreementSuspendedUnsuspendedToProducer";

export async function handleAgreementSuspendedUnsuspended(
  agreementV2Msg: AgreementV2 | undefined,
  logger: Logger,
  readModelService: ReadModelServiceSQL,
  eventType: AgreementSuspendedUnsuspendedEventType
): Promise<NewNotification[]> {
  if (!agreementV2Msg) {
    throw missingKafkaMessageDataError("agreement", eventType);
  }
  logger.info(
    `Sending in-app notification for handleAgreementSuspendedUnsuspended - entityId: ${agreementV2Msg.id}, eventType: ${eventType}`
  );

  const agreement = fromAgreementV2(agreementV2Msg);
  // Notify producer, consumer or both?
  const audiencesToNotify = getAudiencesToNotify(eventType);

  const usersWithNotifications = await getUsersWithNotificationsEnabled(
    agreement,
    audiencesToNotify,
    readModelService,
    logger
  );

  if (usersWithNotifications.length === 0) {
    logger.info(
      `No users with notifications enabled for handleAgreementSuspendedUnsuspended - entityId: ${agreement.id}, eventType: ${eventType}`
    );
    return [];
  }

  const [eservice, { consumerName, producerName }] = await Promise.all([
    retrieveEservice(agreement.eserviceId, readModelService),
    getConsumerAndProducerNames(agreement, readModelService),
  ]);

  return usersWithNotifications.map(
    ({ userId, tenantId, notificationType }) => {
      const body = getNotificationBody(
        eventType,
        notificationType,
        eservice.name,
        consumerName,
        producerName
      );
      return {
        userId,
        tenantId,
        body,
        notificationType,
        entityId: agreement.id,
      };
    }
  );
}

async function getConsumerAndProducerNames(
  agreement: {
    producerId: TenantId;
    consumerId: TenantId;
  },
  readModelService: ReadModelServiceSQL
): Promise<{ consumerName: string; producerName: string }> {
  const [consumer, producer] = await Promise.all([
    retrieveTenant(agreement.consumerId, readModelService),
    retrieveTenant(agreement.producerId, readModelService),
  ]);
  return { consumerName: consumer.name, producerName: producer.name };
}

function getNotificationBody(
  eventType: AgreementSuspendedUnsuspendedEventType,
  notificationType: NotificationType,
  eserviceName: string,
  consumerName: string,
  producerName: string
): string {
  return match(eventType)
    .with("AgreementSuspendedByConsumer", () =>
      inAppTemplates.agreementSuspendedByConsumerToProducer(
        consumerName,
        eserviceName
      )
    )
    .with("AgreementSuspendedByPlatform", () =>
      notificationType === "agreementSuspendedUnsuspendedToConsumer"
        ? inAppTemplates.agreementSuspendedByPlatformToConsumer(eserviceName)
        : inAppTemplates.agreementSuspendedByPlatformToProducer(
            consumerName,
            eserviceName
          )
    )
    .with("AgreementUnsuspendedByConsumer", () =>
      inAppTemplates.agreementUnsuspendedByConsumerToProducer(
        consumerName,
        eserviceName
      )
    )
    .with("AgreementUnsuspendedByPlatform", () =>
      notificationType === "agreementSuspendedUnsuspendedToConsumer"
        ? inAppTemplates.agreementUnsuspendedByPlatformToConsumer(eserviceName)
        : inAppTemplates.agreementUnsuspendedByPlatformToProducer(
            consumerName,
            eserviceName
          )
    )
    .with("AgreementArchivedByConsumer", () =>
      inAppTemplates.agreementArchivedByConsumerToProducer(
        consumerName,
        eserviceName
      )
    )
    .with("AgreementSuspendedByProducer", () =>
      inAppTemplates.agreementSuspendedByProducerToConsumer(
        producerName,
        eserviceName
      )
    )
    .with("AgreementUnsuspendedByProducer", () =>
      inAppTemplates.agreementUnsuspendedByProducerToConsumer(
        producerName,
        eserviceName
      )
    )
    .exhaustive();
}

function getAudiencesToNotify(
  eventType: AgreementSuspendedUnsuspendedEventType
): NotificationAudience[] {
  return match<AgreementSuspendedUnsuspendedEventType, NotificationAudience[]>(
    eventType
  )
    .with("AgreementSuspendedByConsumer", () => ["producer"])
    .with("AgreementUnsuspendedByConsumer", () => ["producer"])
    .with("AgreementSuspendedByProducer", () => ["consumer"])
    .with("AgreementUnsuspendedByProducer", () => ["consumer"])
    .with("AgreementSuspendedByPlatform", () => ["consumer", "producer"])
    .with("AgreementUnsuspendedByPlatform", () => ["consumer", "producer"])
    .with("AgreementArchivedByConsumer", () => ["producer"])
    .exhaustive();
}

async function getUsersWithNotificationsEnabled(
  agreement: { consumerId: TenantId; producerId: TenantId },
  audiences: NotificationAudience[],
  readModelService: ReadModelServiceSQL,
  logger: Logger
): Promise<
  Array<{
    userId: UserId;
    tenantId: TenantId;
    notificationType: NotificationType;
  }>
> {
  const configPromises = audiences.map(async (audience) => {
    const audienceId =
      audience === "consumer" ? agreement.consumerId : agreement.producerId;

    const notificationType = match<NotificationAudience, NotificationType>(
      audience
    )
      .with("consumer", () => "agreementSuspendedUnsuspendedToConsumer")
      .with("producer", () => "agreementSuspendedUnsuspendedToProducer")
      .exhaustive();

    return getNotificationRecipients(
      [audienceId],
      notificationType,
      readModelService,
      logger
    ).then((config) => config.map((c) => ({ ...c, notificationType })));
  });

  const results = await Promise.all(configPromises);
  return results.flat();
}
