import {
  EmailNotificationMessagePayload,
  fromPurposeV2,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
  purposeVersionState,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  retrieveEservice,
  retrieveHTMLTemplate,
  purposeOverQuotaTemplate,
  retrieveTenant,
  getRecipientsForTenants,
  mapRecipientToEmailPayload,
} from "pagopa-interop-notification-commons";

import { config } from "../../config/config.js";
import { PurposeHandlerParams } from "../../models/handlerParams.js";

const notificationType: NotificationType = "purposeOverQuotaStateToConsumer";

export async function handlePurposeWaitingForApprovalToConsumer(
  data: PurposeHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    purposeV2Msg,
    readModelService,
    logger,
    templateService,
    correlationId,
  } = data;

  if (!purposeV2Msg) {
    throw missingKafkaMessageDataError("purpose", "PurposeWaitingForApproval");
  }
  const purpose = fromPurposeV2(purposeV2Msg);
  const version = purpose.versions.find(
    (v) => v.state === purposeVersionState.waitingForApproval
  );
  const reason = version?.waitingForApprovalReason;
  if (!reason) {
    logger.warn(
      `Expected waitingForApprovalReason was not found; skipping consumer quota notification - purposeId: ${purpose.id}, versionId: ${version?.id ?? "unknown"}, eventType: PurposeWaitingForApproval`
    );
    return [];
  }

  const [htmlTemplate, eservice] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.purposeQuotaOverthresholdMailTemplate
    ),
    retrieveEservice(purpose.eserviceId, readModelService),
  ]);

  const content = purposeOverQuotaTemplate(
    purpose.title,
    eservice.name,
    reason
  );

  const consumer = await retrieveTenant(purpose.consumerId, readModelService);

  const targets = await getRecipientsForTenants({
    tenants: [consumer],
    notificationType,
    readModelService,
    logger,
    includeTenantContactEmails: true,
  });

  if (targets.length === 0) {
    logger.info(
      `No users with email notifications enabled for handlePurposeWaitingForApprovalToConsumer - entityId: ${purpose.id}, eventType: ${notificationType}`
    );
    return [];
  }

  return targets.map((t) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: content.title,
      body: templateService.compileHtml(htmlTemplate, {
        title: content.title,
        body: content.body,
        notificationType,
        entityId: purpose.id,
        ...(t.type === "Tenant" ? { recipientName: consumer.name } : {}),
        ctaLabel: "Visualizza finalità",
        selfcareId: consumer.selfcareId,
        bffUrl: config.bffUrl,
      }),
    },
    tenantId: consumer.id,
    ...mapRecipientToEmailPayload(t),
  }));
}
