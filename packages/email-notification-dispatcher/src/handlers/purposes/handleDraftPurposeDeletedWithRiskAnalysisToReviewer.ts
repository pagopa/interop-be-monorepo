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

const notificationType: NotificationType =
  "draftPurposeDeletedWithRiskAnalysisToReviewer";
const title = "Finalità eliminata con analisi del rischio assegnata a te";

export async function handleDraftPurposeDeletedWithRiskAnalysisToReviewer({
  purposeV2Msg,
  readModelService,
  logger,
  templateService,
  correlationId,
}: PurposeHandlerParams): Promise<EmailNotificationMessagePayload[]> {
  if (!purposeV2Msg) {
    throw missingKafkaMessageDataError("purpose", "DraftPurposeDeleted");
  }

  const purpose = fromPurposeV2(purposeV2Msg);
  const reviewerIds = purpose.reviewerWorkflow?.reviewers
    .filter(({ sentToReviewerAt }) => sentToReviewerAt)
    .map(({ id }) => id);
  if (!reviewerIds || reviewerIds.length === 0) {
    return [];
  }

  const [htmlTemplate, eservice, consumer] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.draftPurposeDeletedWithRiskAnalysisToReviewerMailTemplate
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
