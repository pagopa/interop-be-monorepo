import {
  EmailNotificationMessagePayload,
  generateId,
  missingKafkaMessageDataError,
  fromAgreementV2,
  NotificationType,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  retrieveHTMLTemplate,
  retrieveTenant,
} from "../../services/utils.js";
import {
  AgreementHandlerParams,
  getRecipientsForTenants,
  mapRecipientToEmailPayload,
  retrieveAgreementEservice,
} from "../handlerCommons.js";
import { config } from "../../config/config.js";

const notificationType: NotificationType =
  "agreementActivatedRejectedToConsumer";

export async function handleAgreementActivatedToConsumer(
  data: AgreementHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    agreementV2Msg,
    readModelService,
    logger,
    templateService,
    correlationId,
  } = data;

  if (!agreementV2Msg) {
    throw missingKafkaMessageDataError("agreement", "AgreementActivated");
  }

  const agreement = fromAgreementV2(agreementV2Msg);

  const [htmlTemplate, eservice, producer, consumer] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.agreementActivatedToConsumerMailTemplate
    ),
    retrieveAgreementEservice(agreement, readModelService),
    retrieveTenant(agreement.producerId, readModelService),
    retrieveTenant(agreement.consumerId, readModelService),
  ]);

  const targets = await getRecipientsForTenants({
    tenants: [consumer],
    notificationType,
    readModelService,
    logger,
    includeTenantContactEmails: true,
  });

  if (targets.length === 0) {
    logger.info(
      `No targets found for tenant. Agreement ${agreement.id}, no emails to dispatch.`
    );
    return [];
  }

  return targets.map((t) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `La tua richiesta per "${eservice.name}" è stata accettata`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `La tua richiesta per "${eservice.name}" è stata accettata`,
        notificationType,
        entityId: agreement.id,
        ...(t.type === "Tenant" ? { recipientName: consumer.name } : {}),
        producerName: producer.name,
        eserviceName: eservice.name,
        ctaLabel: `Visualizza richiesta`,
        selfcareId: t.selfcareId,
        bffUrl: config.bffUrl,
      }),
    },
    tenantId: t.tenantId,
    ...mapRecipientToEmailPayload(t),
  }));
}
