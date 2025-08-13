/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */
import { HtmlTemplateService, Logger } from "pagopa-interop-commons";
import {
  EmailNotificationMessagePayload,
  generateId,
  CorrelationId,
  missingKafkaMessageDataError,
  AgreementV2,
  fromAgreementV2,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  retrieveHTMLTemplate,
  retrieveTenant,
} from "../../services/utils.js";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { UserServiceSQL } from "../../services/userServiceSQL.js";
import {
  getUserEmailsToNotify,
  retrieveAgreementEservice,
} from "../handlerCommons.js";

export type AgreementSuspendedByConsumerData = {
  agreementV2Msg?: AgreementV2;
  readModelService: ReadModelServiceSQL;
  logger: Logger;
  templateService: HtmlTemplateService;
  userService: UserServiceSQL;
  interopFeBaseUrl: string;
  correlationId: CorrelationId;
};

export async function handleAgreementSuspendedByConsumer(
  data: AgreementSuspendedByConsumerData
): Promise<EmailNotificationMessagePayload[]> {
  const {
    agreementV2Msg,
    readModelService,
    logger,
    templateService,
    userService,
    interopFeBaseUrl,
    correlationId,
  } = data;

  if (!agreementV2Msg) {
    throw missingKafkaMessageDataError(
      "eservice",
      "AgreementSuspendedByConsumer"
    );
  }

  const agreement = fromAgreementV2(agreementV2Msg);

  const [htmlTemplate, eservice, producer, consumer] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.agreementSuspendedByConsumerMailTemplate
    ),
    retrieveAgreementEservice(agreement, readModelService),
    retrieveTenant(agreement.producerId, readModelService),
    retrieveTenant(agreement.consumerId, readModelService),
  ]);

  let userEmails: string[] = [];
  try {
    userEmails = await getUserEmailsToNotify(
      producer.id,
      "agreementSuspendedUnsuspendedToProducer",
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
          interopFeUrl: `https://${interopFeBaseUrl}/ui/it/fruizione/richieste/${agreement.id}`,
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
