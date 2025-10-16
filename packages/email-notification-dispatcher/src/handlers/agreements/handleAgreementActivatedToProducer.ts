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

const notificationType: NotificationType = "agreementManagementToProducer";

export async function handleAgreementActivatedToProducer(
  params: AgreementHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    agreementV2Msg,
    readModelService,
    logger,
    templateService,
    userService,
    correlationId,
  } = params;

  if (!agreementV2Msg) {
    throw missingKafkaMessageDataError("agreement", "AgreementActivated");
  }

  const agreement = fromAgreementV2(agreementV2Msg);

  const [htmlTemplate, eservice, producer] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.agreementActivatedToProducerMailTemplate
    ),
    retrieveAgreementEservice(agreement, readModelService),
    retrieveTenant(agreement.producerId, readModelService),
  ]);

  const targets = await getRecipientsForTenants({
    tenants: [producer],
    notificationType,
    readModelService,
    userService,
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
      subject: `Richiesta di fruizione accettata automaticamente`,
      body: templateService.compileHtml(htmlTemplate, {
        title: "Richiesta di fruizione accettata automaticamente",
        notificationType,
        entityId: agreement.id,
        producerName: producer.name,
        eserviceName: eservice.name,
        ctaLabel: `Visualizza richiesta`,
      }),
    },
    tenantId: t.tenantId,
    ...mapRecipientToEmailPayload(t),
  }));
}
