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
  "agreementSuspendedUnsuspendedToProducer";

export async function handleAgreementUnsuspendedByConsumer(
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
      "eservice",
      "AgreementUnsuspendedByConsumer"
    );
  }

  const agreement = fromAgreementV2(agreementV2Msg);

  const [htmlTemplate, eservice, producer, consumer] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.agreementUnsuspendedByConsumerMailTemplate
    ),
    retrieveAgreementEservice(agreement, readModelService),
    retrieveTenant(agreement.producerId, readModelService),
    retrieveTenant(agreement.consumerId, readModelService),
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

  return targets.map(({ address }) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `Riattivazione richiesta di fruizione da parte del fruitore`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `Riattivazione richiesta di fruizione da parte del fruitore`,
        notificationType,
        entityId: agreement.id,
        consumerName: consumer.name,
        producerName: producer.name,
        eserviceName: eservice.name,
        ctaLabel: `Visualizza richiesta`,
      }),
    },
    address,
  }));
}
