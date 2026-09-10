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

const notificationType = "purposeRiskAnalysisSignedToReviewer" as const;

export async function handlePurposeRiskAnalysisSignedToReviewer(
  purposeV2Msg: PurposeV2 | undefined,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  if (!purposeV2Msg) {
    throw missingKafkaMessageDataError("purpose", "PurposeRiskAnalysisSigned");
  }

  const purpose = fromPurposeV2(purposeV2Msg);
  const reviewerWorkflow = purpose.reviewerWorkflow;
  if (!reviewerWorkflow?.signedBy) {
    return [];
  }

  const reviewerIds = reviewerWorkflow.reviewers
    .filter(({ id }) => id !== reviewerWorkflow.signedBy)
    .map(({ id }) => id);
  if (reviewerIds.length === 0) {
    return [];
  }

  const selectedReviewerIds = new Set(reviewerIds);
  const recipients = (
    await getNotificationRecipients(
      [purpose.consumerId],
      notificationType,
      readModelService,
      logger
    )
  ).filter(({ userId }) => selectedReviewerIds.has(userId));

  if (recipients.length === 0) {
    return [];
  }

  const eservice = await retrieveEservice(purpose.eserviceId, readModelService);
  const body = inAppTemplates.purposeRiskAnalysisSignedToReviewer(
    purpose.title,
    eservice.name
  );

  return recipients.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType,
    entityId: purpose.id,
  }));
}
