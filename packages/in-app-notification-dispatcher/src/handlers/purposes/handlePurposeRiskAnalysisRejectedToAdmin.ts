import { Logger } from "pagopa-interop-commons";
import {
  fromPurposeV2,
  missingKafkaMessageDataError,
  NewNotification,
  PurposeV2,
} from "pagopa-interop-models";
import {
  getNotificationRecipients,
  inAppTemplates,
  retrieveEservice,
} from "pagopa-interop-notification-commons";

import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";

export async function handlePurposeRiskAnalysisRejectedToAdmin(
  purposeV2Msg: PurposeV2 | undefined,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  if (!purposeV2Msg) {
    throw missingKafkaMessageDataError(
      "purpose",
      "PurposeRiskAnalysisRejected"
    );
  }
  const purpose = fromPurposeV2(purposeV2Msg);
  logger.info(
    `Sending in-app notification for handlePurposeRiskAnalysisRejectedToAdmin - entityId: ${purpose.id}`
  );
  const recipients = await getNotificationRecipients(
    [purpose.consumerId],
    "purposeRiskAnalysisRejectedToAdmin",
    readModelService,
    logger
  );
  if (recipients.length === 0) {
    return [];
  }
  const eservice = await retrieveEservice(purpose.eserviceId, readModelService);
  const body = inAppTemplates.purposeRiskAnalysisRejectedToAdmin(
    purpose.title,
    eservice.name
  );
  return recipients.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "purposeRiskAnalysisRejectedToAdmin",
    entityId: purpose.id,
  }));
}
