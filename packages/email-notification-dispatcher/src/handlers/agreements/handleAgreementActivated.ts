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
import { UserDB } from "pagopa-interop-selfcare-user-db-models";
import {
  eventMailTemplateType,
  getFormattedAgreementStampDate,
  retrieveAgreementDescriptor,
  retrieveAgreementEservice,
  retrieveHTMLTemplate,
  retrieveTenant,
} from "../../services/utils.js";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { UserServiceSQL } from "../../services/userServiceSQL.js";

export type AgreementActivatedData = {
  agreementV2Msg?: AgreementV2;
  readModelService: ReadModelServiceSQL;
  logger: Logger;
  templateService: HtmlTemplateService;
  userService: UserServiceSQL;
  interopFeBaseUrl: string;
  correlationId: CorrelationId;
};

export async function handleAgreementActivated(
  data: AgreementActivatedData
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
    throw missingKafkaMessageDataError("eservice", "AgreementActivated");
  }

  const agreement = fromAgreementV2(agreementV2Msg);

  const [htmlTemplate, eservice, producer, consumer] = await Promise.all([
    retrieveHTMLTemplate(eventMailTemplateType.agreementActivatedMailTemplate),
    retrieveAgreementEservice(agreement, readModelService),
    retrieveTenant(agreement.producerId, readModelService),
    retrieveTenant(agreement.consumerId, readModelService),
  ]);

  const tenantUsers =
    await readModelService.getTenantUsersWithNotificationEnabled(
      [consumer.id],
      "agreementActivatedRejectedToConsumer"
    );

  let usersToNotify: UserDB[] = [];
  try {
    const userResults = await Promise.all(
      tenantUsers
        .map((config) => config.userId)
        .map((userId) => userService.readUser(userId))
    );
    usersToNotify = userResults.filter(
      (userResult): userResult is UserDB => userResult !== undefined
    );
  } catch (error) {
    logger.warn(`Error reading user email. Reason: ${error}`);
  }

  const userEmails = usersToNotify.map((user) => user.email);

  const activationDate = getFormattedAgreementStampDate(
    agreement,
    "activation"
  );

  const descriptor = retrieveAgreementDescriptor(eservice, agreement);

  return userEmails.map((email: string) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `Richiesta di fruizione ${agreement.id} attiva`,
      body: templateService.compileHtml(htmlTemplate, {
        title: "Nuova richiesta di fruizione",
        interopFeUrl: `https://${interopFeBaseUrl}/ui/it/fruizione/richieste/${agreement.id}`,
        producerName: producer.name,
        consumerName: consumer.name,
        eserviceName: eservice.name,
        eserviceVersion: descriptor.version,
        activationDate,
      }),
    },
    address: email,
  }));
}
