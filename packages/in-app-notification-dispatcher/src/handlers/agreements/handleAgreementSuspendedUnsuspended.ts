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
    `Handle agreement suspended/unsuspended/archived in-app notification for ${eventType} agreement ${agreementV2Msg.id}`
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
      `No users with notifications enabled for ${eventType} agreement ${agreement.id}`
    );
    return [];
  }

  const [eservice, subjectName] = await Promise.all([
    retrieveEservice(agreement.eserviceId, readModelService),
    getSubjectName(agreement, eventType, readModelService),
  ]);

  const action: "sospeso" | "riattivato" | "archiviato" =
    getActionPerformed(eventType);
  const body = inAppTemplates.agreementSuspendedUnsuspended(
    action,
    subjectName,
    eservice.name
  );

  return usersWithNotifications.map(
    ({ userId, tenantId, notificationType }) => ({
      userId,
      tenantId,
      body,
      notificationType,
      entityId: agreement.id,
    })
  );
}

async function getSubjectName(
  agreement: {
    producerId: TenantId;
    consumerId: TenantId;
  },
  eventType: AgreementSuspendedUnsuspendedEventType,
  readModelService: ReadModelServiceSQL
): Promise<string> {
  const getTenantName = async (tenantId: TenantId): Promise<string> => {
    const tenant = await retrieveTenant(tenantId, readModelService);
    return tenant.name;
  };

  return match<AgreementSuspendedUnsuspendedEventType, Promise<string>>(
    eventType
  )
    .with(
      "AgreementSuspendedByConsumer",
      "AgreementUnsuspendedByConsumer",
      "AgreementArchivedByConsumer",
      () => getTenantName(agreement.consumerId)
    )
    .with(
      "AgreementSuspendedByProducer",
      "AgreementUnsuspendedByProducer",
      () => getTenantName(agreement.producerId)
    )
    .with(
      "AgreementSuspendedByPlatform",
      "AgreementUnsuspendedByPlatform",
      () => Promise.resolve("La piattaforma")
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

function getActionPerformed(
  eventType: AgreementSuspendedUnsuspendedEventType
): "sospeso" | "riattivato" | "archiviato" {
  return match<
    AgreementSuspendedUnsuspendedEventType,
    "sospeso" | "riattivato" | "archiviato"
  >(eventType)
    .with(
      "AgreementSuspendedByConsumer",
      "AgreementSuspendedByProducer",
      "AgreementSuspendedByPlatform",
      () => "sospeso"
    )
    .with(
      "AgreementUnsuspendedByConsumer",
      "AgreementUnsuspendedByProducer",
      "AgreementUnsuspendedByPlatform",
      () => "riattivato"
    )
    .with("AgreementArchivedByConsumer", () => "archiviato")
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
