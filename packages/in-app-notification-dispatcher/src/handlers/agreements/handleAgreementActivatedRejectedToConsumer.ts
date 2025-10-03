import {
  AgreementV2,
  fromAgreementV2,
  missingKafkaMessageDataError,
  NewNotification,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { UserServiceSQL } from "../../services/userServiceSQL.js";
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
  userService: UserServiceSQL,
  eventType: "AgreementActivated" | "AgreementRejected"
): Promise<NewNotification[]> {
  if (!agreementV2Msg) {
    throw missingKafkaMessageDataError("agreement", eventType);
  }
  logger.info(
    `Handle agreement activated/rejected in-app notification for ${eventType} agreement ${agreementV2Msg.id}`
  );

  const agreement = fromAgreementV2(agreementV2Msg);

  const usersWithNotifications = await getNotificationRecipients(
    [agreement.consumerId],
    "agreementActivatedRejectedToConsumer",
    readModelService,
    userService,
    logger
  );

  if (usersWithNotifications.length === 0) {
    logger.info(
      `No users with notifications enabled for ${eventType} agreement ${agreement.id}`
    );
    return [];
  }

  const eservice = await retrieveEservice(
    agreement.eserviceId,
    readModelService
  );
  const producer = await retrieveTenant(agreement.producerId, readModelService);

  const body = inAppTemplates.agreementActivatedRejectedToConsumer(
    producer.name,
    eservice.name,
    match(eventType)
      .with("AgreementActivated", () => "attivato" as const)
      .with("AgreementRejected", () => "rifiutato" as const)
      .exhaustive()
  );

  return usersWithNotifications.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "agreementActivatedRejectedToConsumer",
    entityId: agreement.id,
  }));
}
