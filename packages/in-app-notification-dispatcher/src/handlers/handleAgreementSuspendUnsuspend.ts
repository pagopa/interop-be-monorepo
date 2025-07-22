import {
  AgreementV2,
  fromAgreementV2,
  Notification,
  generateId,
  missingKafkaMessageDataError,
  TenantId,
  UserId,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { match } from "ts-pattern";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import { inAppTemplates } from "../templates/inAppTemplates.js";
import { config } from "../config/config.js";
import { retrieveTenant, retrieveEservice } from "./handlerCommons.js";

type AgreementSuspendUnsuspendEventType =
  | "AgreementSuspendedByConsumer"
  | "AgreementUnsuspendedByConsumer"
  | "AgreementSuspendedByProducer"
  | "AgreementUnsuspendedByProducer"
  | "AgreementSuspendedByPlatform"
  | "AgreementUnsuspendedByPlatform";

type NotificationAudience = "consumer" | "producer";
type ActionType = "sospeso" | "riattivato";

type NotificationConfig =
  | "consumptionAgreementSuspendedUnsuspended"
  | "productionAgreementSuspendedUnsuspended";

export async function handleAgreementSuspendedUnsuspended(
  agreementV2Msg: AgreementV2 | undefined,
  logger: Logger,
  readModelService: ReadModelServiceSQL,
  eventType: AgreementSuspendUnsuspendEventType
): Promise<Notification[]> {
  if (!agreementV2Msg) {
    throw missingKafkaMessageDataError("agreement", eventType);
  }
  logger.info(
    `Handle agreement suspended/unsuspended in-app notification for ${eventType} agreement ${agreementV2Msg.id}`
  );

  const agreement = fromAgreementV2(agreementV2Msg);
  // Notify producer, consumer or both?
  const audiencesToNotify = getAudiencesToNotify(eventType);

  const usersWithNotifications = await getUsersWithNotificationsEnabled(
    agreement,
    audiencesToNotify,
    readModelService
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

  // sospeso or riattivato
  const action = getActionPerformed(eventType);
  const body = inAppTemplates.agreementSuspendedUnsuspended(
    action,
    subjectName,
    eservice.name
  );
  const createdAt = new Date();
  const deepLink = `https://${config.interopFeBaseUrl}/ui/it/fruizione/sottoscrizione-eservice/${agreement.id}`;

  return usersWithNotifications.map(({ userId, tenantId }) => ({
    id: generateId(),
    createdAt,
    userId,
    tenantId,
    body,
    deepLink,
    readAt: undefined,
  }));
}

async function getSubjectName(
  agreement: {
    producerId: TenantId;
    consumerId: TenantId;
  },
  eventType: AgreementSuspendUnsuspendEventType,
  readModelService: ReadModelServiceSQL
): Promise<string> {
  const getTenantName = async (tenantId: TenantId): Promise<string> => {
    const tenant = await retrieveTenant(tenantId, readModelService);
    return tenant.name;
  };

  return match<AgreementSuspendUnsuspendEventType, Promise<string>>(eventType)
    .with(
      "AgreementSuspendedByConsumer",
      "AgreementUnsuspendedByConsumer",
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
  eventType: AgreementSuspendUnsuspendEventType
): NotificationAudience[] {
  return match<AgreementSuspendUnsuspendEventType, NotificationAudience[]>(
    eventType
  )
    .with("AgreementSuspendedByConsumer", () => ["producer"])
    .with("AgreementUnsuspendedByConsumer", () => ["producer"])
    .with("AgreementSuspendedByProducer", () => ["consumer"])
    .with("AgreementUnsuspendedByProducer", () => ["consumer"])
    .with("AgreementSuspendedByPlatform", () => ["consumer", "producer"])
    .with("AgreementUnsuspendedByPlatform", () => ["consumer", "producer"])
    .exhaustive();
}

function getActionPerformed(
  eventType: AgreementSuspendUnsuspendEventType
): ActionType {
  return match<AgreementSuspendUnsuspendEventType, ActionType>(eventType)
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
    .exhaustive();
}

async function getUsersWithNotificationsEnabled(
  agreement: { consumerId: TenantId; producerId: TenantId },
  audiences: NotificationAudience[],
  readModelService: ReadModelServiceSQL
): Promise<
  Array<{
    userId: UserId;
    tenantId: TenantId;
  }>
> {
  const configPromises = audiences.map(async (audience) => {
    const audienceId =
      audience === "consumer" ? agreement.consumerId : agreement.producerId;

    return readModelService.getTenantUsersWithNotificationEnabled(
      [audienceId],
      match<NotificationAudience, NotificationConfig>(audience)
        .with("consumer", () => "consumptionAgreementSuspendedUnsuspended")
        .with("producer", () => "productionAgreementSuspendedUnsuspended")
        .exhaustive()
    );
  });

  const results = await Promise.all(configPromises);
  return results.flat();
}
