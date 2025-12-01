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

type PurposeQuotaAdjustmentRequestToProducerType =
  | "NewPurposeVersionWaitingForApproval"
  | "PurposeWaitingForApproval";

export async function handlePurposeQuotaAdjustmentRequestToProducer(
  purposeV2Msg: PurposeV2 | undefined,
  logger: Logger,
  readModelService: ReadModelServiceSQL,
  type: PurposeQuotaAdjustmentRequestToProducerType
): Promise<NewNotification[]> {
  if (!purposeV2Msg) {
    throw missingKafkaMessageDataError("purpose", type);
  }
  logger.info(
    `Sending in-app notification for handlePurposeQuotaAdjustmentRequestToProducer ${purposeV2Msg.id}`
  );
  const purpose = fromPurposeV2(purposeV2Msg);
  const eservice = await retrieveEservice(purpose.eserviceId, readModelService);

  const usersWithNotifications = await getNotificationRecipients(
    [eservice.producerId],
    "purposeQuotaAdjustmentRequestToProducer",
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

  const body = match(type)
    .with("NewPurposeVersionWaitingForApproval", () =>
      inAppTemplates.purposeQuotaAdjustmentNewVersionToProducer(
        consumer.name,
        purpose.title,
        eservice.name
      )
    )
    .with("PurposeWaitingForApproval", () =>
      inAppTemplates.purposeQuotaAdjustmentFirstVersionToProducer(
        consumer.name,
        purpose.title,
        eservice.name
      )
    )
    .exhaustive();

  return usersWithNotifications.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "purposeQuotaAdjustmentRequestToProducer",
    entityId: purpose.id,
  }));
}
