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
  getUserEmailsToNotify,
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

  let userEmails: string[] = [];
  try {
    userEmails = await getUserEmailsToNotify(
      producer.id,
      notificationType,
      readModelService,
      userService
    );
  } catch (error) {
    logger.warn(`Error reading user email. Reason: ${error}`);
    return [];
  }

  const activationDate = getFormattedAgreementStampDate(
    agreement,
    "activation"
  );
  const descriptor = retrieveAgreementDescriptor(eservice, agreement);

  let toDispatch: EmailNotificationMessagePayload[] = [];
  if (userEmails.length > 0) {
    toDispatch = userEmails.map((email: string) => ({
      correlationId: correlationId ?? generateId(),
      email: {
        subject: `Richiesta di fruizione ${agreement.id} attiva`,
        body: templateService.compileHtml(htmlTemplate, {
          title: "Nuova richiesta di fruizione",
          notificationType,
          entityId: agreement.id,
          producerName: producer.name,
          consumerName: consumer.name,
          eserviceName: eservice.name,
          eserviceVersion: descriptor.version,
          activationDate,
        }),
      },
      address: email,
    }));
  } else {
    logger.info(
      `No users found for tenant. Agreement ${agreement.id}, no emails to dispatch.`
    );
  }

  return toDispatch;
}
