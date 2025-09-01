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
  getRecipientsForTenants,
  retrieveAgreementEservice,
} from "../handlerCommons.js";

const notificationType: NotificationType =
  "agreementActivatedRejectedToConsumer";

export async function handleAgreementRejected(
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
    throw missingKafkaMessageDataError("eservice", "AgreementRejected");
  }

  const agreement = fromAgreementV2(agreementV2Msg);

  const [htmlTemplate, eservice, producer, consumer] = await Promise.all([
    retrieveHTMLTemplate(eventMailTemplateType.agreementRejectedMailTemplate),
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
    includeTenantContactEmails: true,
  });

  if (targets.length === 0) {
    logger.info(
      `No targets found for tenant. Agreement ${agreement.id}, no emails to dispatch.`
    );
    return [];
  }

  const rejectionDate = getFormattedAgreementStampDate(agreement, "rejection");
  const descriptor = retrieveAgreementDescriptor(eservice, agreement);

  return targets.map(({ address }) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `La tua richiesta per "${eservice.name}" è stata rifiutata`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `La tua richiesta per "${eservice.name}" è stata rifiutata`,
        notificationType,
        entityId: agreement.id,
        producerName: producer.name,
        consumerName: consumer.name,
        eserviceName: eservice.name,
        eserviceVersion: descriptor.version,
        rejectionDate,
      }),
    },
    address,
  }));
}
