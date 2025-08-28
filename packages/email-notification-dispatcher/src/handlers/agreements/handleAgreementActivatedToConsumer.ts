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
  getFormattedAgreementStampDate,
  retrieveAgreementDescriptor,
  retrieveHTMLTemplate,
  retrieveTenant,
} from "../../services/utils.js";
import {
  AgreementHandlerParams,
  retrieveAgreementEservice,
  getRecipientsForTenant,
} from "../handlerCommons.js";

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
    userService,
    correlationId,
  } = data;

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
    tenant: consumer,
    notificationType,
    readModelService,
    logger,
    userService,
    includeTenantContactEmail: true,
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
      subject: `La tua richiesta per "${eservice.name}" è stata accettata`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `La tua richiesta per "${eservice.name}" è stata accettata`,
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
