import {
  EmailNotificationMessagePayload,
  fromPurposeV2,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
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

export async function handleNewPurposeVersionWaitingForApprovalToConsumer(
  data: PurposeHandlerParams & {
    versionId: string;
    eventType?:
      | "NewPurposeVersionWaitingForApproval"
      | "PurposeVersionOverQuotaUnsuspended";
  }
): Promise<EmailNotificationMessagePayload[]> {
  const {
    purposeV2Msg,
    readModelService,
    logger,
    templateService,
    correlationId,
    versionId,
    eventType = "NewPurposeVersionWaitingForApproval",
  } = data;

  if (!purposeV2Msg) {
    throw missingKafkaMessageDataError("purpose", eventType);
  }
  const purpose = fromPurposeV2(purposeV2Msg);
  const version = purpose.versions.find((v) => v.id === versionId);
  const reason = version?.waitingForApprovalReason;
  if (!reason) {
    logger.warn(
      `Expected waitingForApprovalReason was not found; skipping consumer quota notification - purposeId: ${purpose.id}, versionId: ${versionId}, eventType: ${eventType}`
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
      `No users with email notifications enabled for handleNewPurposeVersionWaitingForApprovalToConsumer - entityId: ${purpose.id}, eventType: ${notificationType}`
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
