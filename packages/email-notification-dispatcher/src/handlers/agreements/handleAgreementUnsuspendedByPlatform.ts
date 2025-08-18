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
  retrieveAgreementEservice,
  retrieveHTMLTemplate,
  retrieveTenant,
} from "../../services/utils.js";
import {
  getUserEmailsToNotify,
  HandleAgreementData,
} from "../handlerCommons.js";

const notificationType: NotificationType =
  "agreementSuspendedUnsuspendedToConsumer";

export async function handleAgreementUnsuspendedByPlatform(
  data: HandleAgreementData
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
      "AgreementUnsuspendedByPlatform"
    );
  }

  const agreement = fromAgreementV2(agreementV2Msg);

  const [htmlTemplate, eservice, producer, consumer] = await Promise.all([
    retrieveHTMLTemplate(eventMailTemplateType.agreementSuspendedByProducer),
    retrieveAgreementEservice(agreement, readModelService),
    retrieveTenant(agreement.producerId, readModelService),
    retrieveTenant(agreement.consumerId, readModelService),
  ]);

  let userEmails: string[] = [];
  try {
    userEmails = await getUserEmailsToNotify(
      consumer.id,
      notificationType,
      readModelService,
      userService
    );
  } catch (error) {
    logger.warn(`Error reading user email. Reason: ${error}`);
    return [];
  }

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
