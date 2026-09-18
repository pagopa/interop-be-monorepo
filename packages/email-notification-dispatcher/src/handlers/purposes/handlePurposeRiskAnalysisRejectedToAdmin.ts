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

const notificationType: NotificationType = "purposeRiskAnalysisRejectedToAdmin";

export async function handlePurposeRiskAnalysisRejectedToAdmin({
  purposeV2Msg,
  logger,
  readModelService,
  templateService,
  correlationId,
}: PurposeHandlerParams): Promise<EmailNotificationMessagePayload[]> {
  if (!purposeV2Msg) {
    throw missingKafkaMessageDataError(
      "purpose",
      "PurposeRiskAnalysisRejected"
    );
  }
  const purpose = fromPurposeV2(purposeV2Msg);
  logger.info(
    `Sending email notification for handlePurposeRiskAnalysisRejectedToAdmin - entityId: ${purpose.id}`
  );
  const consumer = await retrieveTenant(purpose.consumerId, readModelService);
  const recipients = await getRecipientsForTenants({
    tenants: [consumer],
    notificationType,
    readModelService,
    logger,
    includeTenantContactEmails: false,
  });
  if (recipients.length === 0) {
    return [];
  }
  const [eservice, htmlTemplate] = await Promise.all([
    retrieveEservice(purpose.eserviceId, readModelService),
    retrieveHTMLTemplate(
      eventMailTemplateType.purposeRiskAnalysisRejectedToAdminMailTemplate
    ),
  ]);
  const title = "Un'analisi del rischio è stata rifiutata";
  return recipients.map((recipient) => ({
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
    ...mapRecipientToEmailPayload(recipient),
  }));
}
