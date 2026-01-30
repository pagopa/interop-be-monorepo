import {
  EmailNotificationMessagePayload,
  fromAgreementV2,
  generateId,
  missingKafkaMessageDataError,
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

const notificationType: NotificationType = "agreementManagementToProducer";

export async function handleAgreementActivatedToProducer(
  params: AgreementHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    agreementV2Msg,
    readModelService,
    logger,
    templateService,
    correlationId,
  } = params;

  if (!agreementV2Msg) {
    throw missingKafkaMessageDataError("agreement", "AgreementActivated");
  }

  const agreement = fromAgreementV2(agreementV2Msg);

  const [htmlTemplate, eservice, producer, consumer] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.agreementActivatedToProducerMailTemplate
    ),
    retrieveAgreementEservice(agreement, readModelService),
    retrieveTenant(agreement.producerId, readModelService),
    retrieveTenant(agreement.consumerId, readModelService),
  ]);

  const targets = await getRecipientsForTenants({
    tenants: [producer],
    notificationType,
    readModelService,
    logger,
    includeTenantContactEmails: false,
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
      subject: `Richiesta di fruizione accettata`,
      body: templateService.compileHtml(htmlTemplate, {
        title: "Richiesta di fruizione accettata",
        notificationType,
        entityId: agreement.id,
        ...(t.type === "Tenant" ? { recipientName: producer.name } : {}),
        consumerName: consumer.name,
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
