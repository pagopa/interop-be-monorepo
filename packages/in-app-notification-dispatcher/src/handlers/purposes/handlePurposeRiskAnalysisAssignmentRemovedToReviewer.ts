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

type EventType =
  | "PurposeRiskAnalysisSelfAssigned"
  | "PurposeRiskAnalysisWorkflowCreated"
  | "PurposeRiskAnalysisAssigned";

const notificationType =
  "purposeRiskAnalysisAssignmentRemovedToReviewer" as const;

export async function handlePurposeRiskAnalysisAssignmentRemovedToReviewer(
  purposeV2Msg: PurposeV2 | undefined,
  reviewerIds: string[],
  logger: Logger,
  readModelService: ReadModelServiceSQL,
  eventType: EventType
): Promise<NewNotification[]> {
  if (!purposeV2Msg) {
    throw missingKafkaMessageDataError("purpose", eventType);
  }

  if (reviewerIds.length === 0) {
    return [];
  }

  const purpose = fromPurposeV2(purposeV2Msg);
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
  const body = inAppTemplates.purposeRiskAnalysisAssignmentRemovedToReviewer(
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
