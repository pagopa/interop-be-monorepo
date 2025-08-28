/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */
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
  getRecipientsForTenant,
  retrieveAgreementEservice,
} from "../handlerCommons.js";

const notificationType: NotificationType = "agreementManagementToProducer";

export async function handleAgreementUpgraded(
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
    throw missingKafkaMessageDataError("eservice", "AgreementUpgraded");
  }

  const agreement = fromAgreementV2(agreementV2Msg);

  const [htmlTemplate, eservice, producer, consumer] = await Promise.all([
    retrieveHTMLTemplate(eventMailTemplateType.agreementUpgradedMailTemplate),
    retrieveAgreementEservice(agreement, readModelService),
    retrieveTenant(agreement.producerId, readModelService),
    retrieveTenant(agreement.consumerId, readModelService),
  ]);

  const targets = await getRecipientsForTenant({
    tenant: producer,
    notificationType,
    readModelService,
    logger,
    userService,
    includeTenantContactEmail: false,
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
      subject: `Richiesta di fruizione aggiornata per un tuo e-service`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `Richiesta di fruizione aggiornata per un tuo e-service`,
        notificationType,
        entityId: agreement.id,
        producerName: producer.name,
        consumerName: consumer.name,
        eserviceName: eservice.name,
      }),
    },
    address,
  }));
}
