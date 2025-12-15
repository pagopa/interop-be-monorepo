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
  "agreementSuspendedUnsuspendedToConsumer";

export async function handleAgreementSuspendedByProducer(
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
    throw missingKafkaMessageDataError(
      "agreement",
      "AgreementSuspendedByProducer"
    );
  }

  const agreement = fromAgreementV2(agreementV2Msg);

  const [htmlTemplate, eservice, producer, consumer] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.agreementSuspendedByProducerMailTemplate
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
    includeTenantContactEmails: false,
  });

  return targets.map((t) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `Sospensione richiesta di fruizione per "${eservice.name}"`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `Sospensione richiesta di fruizione per "${eservice.name}"`,
        notificationType,
        entityId: agreement.id,
        ...(t.type === "Tenant" ? { recipientName: consumer.name } : {}),
        producerName: producer.name,
        eserviceName: eservice.name,
        bffUrl: config.bffUrl,
      }),
    },
    tenantId: t.tenantId,
    ...mapRecipientToEmailPayload(t),
  }));
}
