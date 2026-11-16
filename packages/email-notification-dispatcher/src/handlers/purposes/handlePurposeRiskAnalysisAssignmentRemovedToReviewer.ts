import {
  EmailNotificationMessagePayload,
  fromPurposeV2,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  getRecipientsForTenants,
  mapRecipientToEmailPayload,
  retrieveEservice,
  retrieveHTMLTemplate,
  retrieveTenant,
} from "pagopa-interop-notification-commons";

import { config } from "../../config/config.js";
import { PurposeHandlerParams } from "../../models/handlerParams.js";

type EventType =
  | "PurposeRiskAnalysisSelfAssigned"
  | "PurposeRiskAnalysisWorkflowCreated"
  | "PurposeRiskAnalysisAssigned";

type Params = PurposeHandlerParams & {
  reviewerIds: string[];
  eventType: EventType;
};

const notificationType: NotificationType =
  "purposeRiskAnalysisAssignmentRemovedToReviewer";
const title = "L'assegnazione dell'analisi del rischio è stata rimossa";

export async function handlePurposeRiskAnalysisAssignmentRemovedToReviewer({
  purposeV2Msg,
  reviewerIds,
  eventType,
  readModelService,
  logger,
  templateService,
  correlationId,
}: Params): Promise<EmailNotificationMessagePayload[]> {
  if (!purposeV2Msg) {
    throw missingKafkaMessageDataError("purpose", eventType);
  }

  if (reviewerIds.length === 0) {
    return [];
  }

  const purpose = fromPurposeV2(purposeV2Msg);
  const [htmlTemplate, eservice, consumer] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.purposeRiskAnalysisAssignmentRemovedToReviewerMailTemplate
    ),
    retrieveEservice(purpose.eserviceId, readModelService),
    retrieveTenant(purpose.consumerId, readModelService),
  ]);
  const selectedReviewerIds = new Set(reviewerIds);
  const targets = (
    await getRecipientsForTenants({
      tenants: [consumer],
      notificationType,
      readModelService,
      logger,
      includeTenantContactEmails: false,
    })
  ).filter(
    (target) => target.type === "User" && selectedReviewerIds.has(target.userId)
  );

  return targets.map((target) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: title,
      body: templateService.compileHtml(htmlTemplate, {
        title,
        notificationType,
        entityId: purpose.id,
        purposeTitle: purpose.title,
        eserviceName: eservice.name,
        ctaLabel: "Visualizza finalità",
        selfcareId: consumer.selfcareId,
        bffUrl: config.bffUrl,
      }),
    },
    tenantId: consumer.id,
    ...mapRecipientToEmailPayload(target),
  }));
}
