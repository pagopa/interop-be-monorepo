import { Logger } from "pagopa-interop-commons";
import {
  AgreementV2,
  fromAgreementV2,
  missingKafkaMessageDataError,
  NewNotification,
} from "pagopa-interop-models";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";
import { retrieveTenant, retrieveEservice } from "../handlerCommons.js";

export async function handleAgreementManagementToProducer(
  agreementV2Msg: AgreementV2 | undefined,
  logger: Logger,
  readModelService: ReadModelServiceSQL,
  eventType: "AgreementActivated" | "AgreementSubmitted" | "AgreementUpgraded"
): Promise<NewNotification[]> {
  if (!agreementV2Msg) {
    throw missingKafkaMessageDataError("agreement", eventType);
  }
  logger.info(
    `Handle agreement management in-app notification for ${eventType} agreement ${agreementV2Msg.id}`
  );

  const agreement = fromAgreementV2(agreementV2Msg);

  const usersWithNotifications =
    await readModelService.getTenantUsersWithNotificationEnabled(
      [agreement.producerId],
      "agreementManagementToProducer"
    );

  if (usersWithNotifications.length === 0) {
    logger.info(
      `No users with notifications enabled for ${eventType} agreement ${agreement.id}`
    );
    return [];
  }

  const consumer = await retrieveTenant(agreement.consumerId, readModelService);
  const eservice = await retrieveEservice(
    agreement.eserviceId,
    readModelService
  );

  const NOTIFICATION_BODY_BUILDERS: Record<
    "AgreementActivated" | "AgreementSubmitted" | "AgreementUpgraded",
    (consumerName: string, eserviceName: string) => string
  > = {
    AgreementActivated: inAppTemplates.agreementActivatedToProducer,
    AgreementSubmitted: inAppTemplates.agreementSubmittedToProducer,
    AgreementUpgraded: inAppTemplates.agreementUpgradedToProducer,
  };

  const body = NOTIFICATION_BODY_BUILDERS[eventType](
    consumer.name,
    eservice.name
  );

  return usersWithNotifications.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "agreementManagementToProducer",
    entityId: agreement.id,
  }));
}
