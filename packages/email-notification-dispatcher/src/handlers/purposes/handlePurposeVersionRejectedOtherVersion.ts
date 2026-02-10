import {
  EmailNotificationMessagePayload,
  fromPurposeV2,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  retrieveEService,
  retrieveHTMLTemplate,
  retrieveTenant,
} from "../../services/utils.js";
import {
  getRecipientsForTenants,
  mapRecipientToEmailPayload,
  PurposeHandlerParams,
} from "../handlerCommons.js";
import { config } from "../../config/config.js";

const notificationType: NotificationType = "purposeOverQuotaStateToConsumer";

export async function handlePurposeVersionRejectedOtherVersion(
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
    throw missingKafkaMessageDataError("purpose", "PurposeVersionRejected");
  }
  const purpose = fromPurposeV2(purposeV2Msg);

  // Only send notification if there are multiple versions (version count > 1)
  if (purpose.versions.length <= 1) {
    logger.info(
      `Skipping email notification for handlePurposeVersionRejectedOtherVersion - entityId: ${purpose.id}, eventType: ${notificationType}, reason: purpose has only one version`
    );
    return [];
  }

  const [htmlTemplate, eservice] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.purposeQuotaAdjustmentResponseMailTemplate
    ),
    retrieveEService(purpose.eserviceId, readModelService),
  ]);

  const [consumer, producer] = await Promise.all([
    retrieveTenant(purpose.consumerId, readModelService),
    retrieveTenant(eservice.producerId, readModelService),
  ]);

  const targets = await getRecipientsForTenants({
    tenants: [consumer],
    notificationType,
    readModelService,
    logger,
    includeTenantContactEmails: false,
  });

  if (targets.length === 0) {
    logger.info(
      `No users with email notifications enabled for handlePurposeVersionRejectedOtherVersion - entityId: ${purpose.id}, eventType: ${notificationType}`
    );
    return [];
  }

  return targets.map((t) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `Richiesta di adeguamento piano di carico rifiutata per la finalità "${purpose.title}"`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `Richiesta di adeguamento piano di carico rifiutata per la finalità "${purpose.title}"`,
        notificationType,
        entityId: purpose.id,
        ...(t.type === "Tenant" ? { recipientName: consumer.name } : {}),
        producerName: producer.name,
        purposeTitle: purpose.title,
        eserviceName: eservice.name,
        isAccepted: false,
        ctaLabel: `Visualizza finalità`,
        selfcareId: consumer.selfcareId,
        bffUrl: config.bffUrl,
      }),
    },
    tenantId: consumer.id,
    ...mapRecipientToEmailPayload(t),
  }));
}
