import {
  AgreementV2,
  fromAgreementV2,
  missingKafkaMessageDataError,
  NewNotification,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { retrieveTenant } from "../handlerCommons.js";
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
    `Handle agreement activated/rejected in-app notification for ${eventType} agreement ${agreementV2Msg.id}`
  );

  const agreement = fromAgreementV2(agreementV2Msg);

  const usersWithNotifications =
    await readModelService.getTenantUsersWithNotificationEnabled(
      [agreement.consumerId],
      "agreementActivatedRejectedToConsumer"
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

  const NOTIFICATION_BODY_BUILDERS: Record<
    "AgreementActivated" | "AgreementRejected",
    (producerName: string, eserviceName: string) => string
  > = {
    AgreementActivated: inAppTemplates.agreementActivatedToConsumer,
    AgreementRejected: (_producerName: string, eserviceName: string) =>
      inAppTemplates.agreementRejectedToConsumer(eserviceName),
  };

  const body = NOTIFICATION_BODY_BUILDERS[eventType](
    producer.name,
    eservice.name
  );

  return usersWithNotifications.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "agreementActivatedRejectedToConsumer",
    entityId: agreement.id,
  }));
}
