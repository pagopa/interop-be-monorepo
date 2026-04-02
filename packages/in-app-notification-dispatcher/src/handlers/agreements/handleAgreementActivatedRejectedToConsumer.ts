import {
  AgreementV2,
  fromAgreementV2,
  missingKafkaMessageDataError,
  NewNotification,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import {
  getNotificationRecipients,
  retrieveTenant,
} from "../handlerCommons.js";
import { retrieveEservice } from "../handlerCommons.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";

export async function handleAgreementActivatedRejectedToConsumer(
  agreementV2Msg: AgreementV2 | undefined,
  logger: Logger,
  readModelService: ReadModelServiceSQL,
  eventType: "AgreementActivated" | "AgreementRejected"
): Promise<NewNotification[]> {
  if (!agreementV2Msg) {
    throw missingKafkaMessageDataError("agreement", eventType);
  }
  logger.info(
    `Sending in-app notification for handleAgreementActivatedRejectedToConsumer - entityId: ${agreementV2Msg.id}, eventType: ${eventType}`
  );

  const agreement = fromAgreementV2(agreementV2Msg);

  const usersWithNotifications = await getNotificationRecipients(
    [agreement.consumerId],
    "agreementActivatedRejectedToConsumer",
    readModelService,
    logger
  );

  if (usersWithNotifications.length === 0) {
    logger.info(
      `No users with notifications enabled for handleAgreementActivatedRejectedToConsumer - entityId: ${agreement.id}, eventType: ${eventType}`
    );
    return [];
  }

  const eservice = await retrieveEservice(
    agreement.eserviceId,
    readModelService
  );
  const producer = await retrieveTenant(agreement.producerId, readModelService);

  const body = match(eventType)
    .with("AgreementActivated", () =>
      inAppTemplates.agreementActivatedToConsumer(producer.name, eservice.name)
    )
    .with("AgreementRejected", () =>
      inAppTemplates.agreementRejectedToConsumer(eservice.name)
    )
    .exhaustive();

  return usersWithNotifications.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "agreementActivatedRejectedToConsumer",
    entityId: agreement.id,
  }));
}
