import {
  fromPurposeV2,
  missingKafkaMessageDataError,
  PurposeV2,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { NewNotification } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import {
  getNotificationRecipients,
  retrieveEservice,
  retrieveTenant,
} from "../handlerCommons.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";

type PurposeStatusChangedToProducerType =
  | "PurposeVersionSuspendedByConsumer"
  | "PurposeVersionUnsuspendedByConsumer"
  | "PurposeArchived";

export async function handlePurposeStatusChangedToProducer(
  purposeV2Msg: PurposeV2 | undefined,
  logger: Logger,
  readModelService: ReadModelServiceSQL,
  type: PurposeStatusChangedToProducerType
): Promise<NewNotification[]> {
  if (!purposeV2Msg) {
    throw missingKafkaMessageDataError("purpose", type);
  }
  logger.info(
    `Sending in-app notification for handlePurposeStatusChangedToProducer ${purposeV2Msg.id}`
  );
  const purpose = fromPurposeV2(purposeV2Msg);
  const eservice = await retrieveEservice(purpose.eserviceId, readModelService);

  const usersWithNotifications = await getNotificationRecipients(
    [eservice.producerId],
    "purposeStatusChangedToProducer",
    readModelService,
    logger
  );
  if (usersWithNotifications.length === 0) {
    logger.info(
      `No users with notifications enabled for ${type} purpose ${purpose.id}`
    );
    return [];
  }

  const consumer = await retrieveTenant(purpose.consumerId, readModelService);

  const body = inAppTemplates.purposeStatusChangedToProducer(
    purpose.title,
    consumer.name,
    eservice.name,
    match(type)
      .with("PurposeVersionSuspendedByConsumer", () => "sospeso" as const)
      .with("PurposeVersionUnsuspendedByConsumer", () => "riattivato" as const)
      .with("PurposeArchived", () => "archiviato" as const)
      .exhaustive()
  );

  return usersWithNotifications.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "purposeStatusChangedToProducer",
    entityId: purpose.id,
  }));
}
