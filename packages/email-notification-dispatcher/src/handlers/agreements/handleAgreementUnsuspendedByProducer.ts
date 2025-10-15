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
  retrieveAgreementEservice,
} from "../handlerCommons.js";

const notificationType: NotificationType =
  "agreementSuspendedUnsuspendedToConsumer";

export async function handleAgreementUnsuspendedByProducer(
  data: AgreementHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    agreementV2Msg,
    readModelService,
    logger,
    templateService,
    userService,
    correlationId,
  } = data;

  if (!agreementV2Msg) {
    throw missingKafkaMessageDataError(
      "agreement",
      "AgreementUnsuspendedByProducer"
    );
  }

  const agreement = fromAgreementV2(agreementV2Msg);

  const [htmlTemplate, eservice, producer, consumer] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.agreementUnsuspendedByProducerMailTemplate
    ),
    retrieveAgreementEservice(agreement, readModelService),
    retrieveTenant(agreement.producerId, readModelService),
    retrieveTenant(agreement.consumerId, readModelService),
  ]);

  const targets = await getRecipientsForTenants({
    tenants: [consumer],
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

  return targets.map(({ address }) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `La tua richiesta per "${eservice.name}" è stata riattivata`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `La tua richiesta per "${eservice.name}" è stata riattivata`,
        notificationType,
        entityId: agreement.id,
        consumerName: consumer.name,
        producerName: producer.name,
        eserviceName: eservice.name,
        ctaLabel: `Visualizza la richiesta`,
      }),
    },
    address,
  }));
}
