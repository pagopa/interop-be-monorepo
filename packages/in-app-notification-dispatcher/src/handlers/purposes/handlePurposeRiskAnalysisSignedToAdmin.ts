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

export async function handlePurposeRiskAnalysisSignedToAdmin(
  purposeV2Msg: PurposeV2 | undefined,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  if (!purposeV2Msg) {
    throw missingKafkaMessageDataError("purpose", "PurposeRiskAnalysisSigned");
  }
  const purpose = fromPurposeV2(purposeV2Msg);
  logger.info(
    `Sending in-app notification for handlePurposeRiskAnalysisSignedToAdmin - entityId: ${purpose.id}`
  );
  const recipients = await getNotificationRecipients(
    [purpose.consumerId],
    "purposeRiskAnalysisSignedToAdmin",
    readModelService,
    logger
  );
  if (recipients.length === 0) {
    return [];
  }
  const eservice = await retrieveEservice(purpose.eserviceId, readModelService);
  const body = inAppTemplates.purposeRiskAnalysisSignedToAdmin(
    purpose.title,
    eservice.name
  );
  return recipients.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "purposeRiskAnalysisSignedToAdmin",
    entityId: purpose.id,
  }));
}
