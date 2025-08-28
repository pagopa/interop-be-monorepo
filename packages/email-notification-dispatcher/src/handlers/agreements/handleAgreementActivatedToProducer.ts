/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */
import {
  EmailNotificationMessagePayload,
  fromAgreementV2,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  getFormattedAgreementStampDate,
  retrieveAgreementDescriptor,
  retrieveHTMLTemplate,
  retrieveTenant,
} from "../../services/utils.js";
import {
  AgreementHandlerParams,
  getRecipientsForTenant,
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
    throw missingKafkaMessageDataError("eservice", "AgreementActivated");
  }

  const agreement = fromAgreementV2(agreementV2Msg);

  const [htmlTemplate, eservice, producer, consumer] = await Promise.all([
    retrieveHTMLTemplate(eventMailTemplateType.agreementActivatedMailTemplate),
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

  const activationDate = getFormattedAgreementStampDate(
    agreement,
    "activation"
  );
  const descriptor = retrieveAgreementDescriptor(eservice, agreement);

  return targets.map(({ address }) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `Richiesta di fruizione accettata automaticamente`,
      body: templateService.compileHtml(htmlTemplate, {
        title: "Richiesta di fruizione accettata automaticamente",
        notificationType,
        entityId: agreement.id,
        producerName: producer.name,
        consumerName: consumer.name,
        eserviceName: eservice.name,
        eserviceVersion: descriptor.version,
        activationDate,
      }),
    },
    address,
  }));
}
