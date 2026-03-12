import { Logger } from "pagopa-interop-commons";
import {
  fromPurposeV2,
  missingKafkaMessageDataError,
  PurposeV2,
} from "pagopa-interop-models";
import { NewNotification } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import {
  getNotificationRecipients,
  retrieveEservice,
  retrieveTenant,
} from "../handlerCommons.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";

export async function handlePurposeSuspendedUnsuspendedToConsumer(
  purposeV2Msg: PurposeV2 | undefined,
  logger: Logger,
  readModelService: ReadModelServiceSQL,
  type:
    | "PurposeVersionSuspendedByProducer"
    | "PurposeVersionUnsuspendedByProducer"
): Promise<NewNotification[]> {
  if (!purposeV2Msg) {
    throw missingKafkaMessageDataError("purpose", type);
  }
  logger.info(
    `Sending in-app notification for handlePurposeSuspendedUnsuspendedToConsumer ${purposeV2Msg.id}`
  );
  const purpose = fromPurposeV2(purposeV2Msg);
  const usersWithNotifications = await getNotificationRecipients(
    [purpose.consumerId],
    "purposeSuspendedUnsuspendedToConsumer",
    readModelService,
    logger
  );
  if (usersWithNotifications.length === 0) {
    logger.info(
      `No users with notifications enabled for ${type} purpose ${purpose.id}`
    );
    return [];
  }

  const eservice = await retrieveEservice(purpose.eserviceId, readModelService);
  const producer = await retrieveTenant(eservice.producerId, readModelService);

  const body = inAppTemplates.purposeSuspendedUnsuspendedToConsumer(
    purpose.title,
    producer.name,
    eservice.name,
    match(type)
      .with("PurposeVersionSuspendedByProducer", () => "sospeso" as const)
      .with("PurposeVersionUnsuspendedByProducer", () => "riattivato" as const)
      .exhaustive()
  );

  return usersWithNotifications.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "purposeSuspendedUnsuspendedToConsumer",
    entityId: purpose.id,
  }));
}
