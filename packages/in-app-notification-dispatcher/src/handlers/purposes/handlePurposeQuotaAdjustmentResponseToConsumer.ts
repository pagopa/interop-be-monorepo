import {
  fromPurposeV2,
  missingKafkaMessageDataError,
  PurposeV2,
  NewNotification,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import {
  getNotificationRecipients,
  retrieveEservice,
  retrieveTenant,
} from "../handlerCommons.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";

type PurposeQuotaAdjustmentResponseToConsumerType =
  | "PurposeVersionActivated"
  | "PurposeVersionRejected";

export async function handlePurposeQuotaAdjustmentResponseToConsumer(
  purposeV2Msg: PurposeV2 | undefined,
  logger: Logger,
  readModelService: ReadModelServiceSQL,
  type: PurposeQuotaAdjustmentResponseToConsumerType
): Promise<NewNotification[]> {
  if (!purposeV2Msg) {
    throw missingKafkaMessageDataError("purpose", type);
  }

  const purpose = fromPurposeV2(purposeV2Msg);

  // Only send notification if there are multiple versions (version count > 1)
  if (purpose.versions.length <= 1) {
    logger.info(
      `Purpose ${purpose.id} has only one version, skipping purposeQuotaAdjustmentResponseToConsumer notification`
    );
    return [];
  }

  logger.info(
    `Sending in-app notification for handlePurposeQuotaAdjustmentResponseToConsumer ${purpose.id}`
  );

  const usersWithNotifications = await getNotificationRecipients(
    [purpose.consumerId],
    "purposeOverQuotaStateToConsumer",
    readModelService,
    logger
  );
  if (usersWithNotifications.length === 0) {
    logger.info(
      `No users with notifications enabled for ${type} purpose ${purpose.id}`
    );
    return [];
  }

  const action = match(type)
    .with("PurposeVersionActivated", () => "accettato" as const)
    .with("PurposeVersionRejected", () => "rifiutato" as const)
    .exhaustive();

  const eservice = await retrieveEservice(purpose.eserviceId, readModelService);
  const producer = await retrieveTenant(eservice.producerId, readModelService);

  const body = inAppTemplates.purposeQuotaAdjustmentResponseToConsumer(
    producer.name,
    purpose.title,
    eservice.name,
    action
  );

  return usersWithNotifications.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "purposeOverQuotaStateToConsumer",
    entityId: purpose.id,
  }));
}
