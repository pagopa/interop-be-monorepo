/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */
import {
  getLatestTenantMailOfKind,
  HtmlTemplateService,
  Logger,
} from "pagopa-interop-commons";
import {
  EmailNotificationMessagePayload,
  generateId,
  CorrelationId,
  missingKafkaMessageDataError,
  AgreementV2,
  fromAgreementV2,
  tenantMailKind,
} from "pagopa-interop-models";
import { UserDB } from "pagopa-interop-selfcare-user-db-models";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { UserServiceSQL } from "../../services/userServiceSQL.js";
import {
  eventMailTemplateType,
  getFormattedAgreementStampDate,
  retrieveAgreementDescriptor,
  retrieveAgreementEservice,
  retrieveHTMLTemplate,
  retrieveTenant,
} from "../../services/utils.js";

export type AgreementRejectedData = {
  agreementV2Msg?: AgreementV2;
  readModelService: ReadModelServiceSQL;
  logger: Logger;
  templateService: HtmlTemplateService;
  userService: UserServiceSQL;
  interopFeBaseUrl: string;
  correlationId?: CorrelationId;
};

export async function handleAgreementRejected(
  data: AgreementRejectedData
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
    throw missingKafkaMessageDataError("eservice", "AgreementRejected");
  }

  const agreement = fromAgreementV2(agreementV2Msg);

  const [htmlTemplate, eservice, producer, consumer] = await Promise.all([
    retrieveHTMLTemplate(eventMailTemplateType.agreementRejectedMailTemplate),
    retrieveAgreementEservice(agreement, readModelService),
    retrieveTenant(agreement.producerId, readModelService),
    retrieveTenant(agreement.consumerId, readModelService),
  ]);

  const consumerEmail = getLatestTenantMailOfKind(
    consumer.mails,
    tenantMailKind.ContactEmail
  );

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
    return [];
  }

  const userEmails = usersToNotify.map((user) => user.email);
  const rejectionDate = getFormattedAgreementStampDate(agreement, "rejection");
  const descriptor = retrieveAgreementDescriptor(eservice, agreement);

  let toDispatch: EmailNotificationMessagePayload[] = [];
  if (userEmails.length > 0) {
    toDispatch = userEmails.map((email: string) => ({
      correlationId: correlationId ?? generateId<CorrelationId>(),
      email: {
        subject: `Richiesta di fruizione ${agreement.id} attiva`,
        body: templateService.compileHtml(htmlTemplate, {
          title: "Nuova richiesta di fruizione",
          interopFeUrl: `https://${interopFeBaseUrl}/ui/it/fruizione/richieste/${agreement.id}`,
          producerName: producer.name,
          consumerName: consumer.name,
          eserviceName: eservice.name,
          eserviceVersion: descriptor.version,
          rejectionDate,
        }),
      },
      address: email,
    }));
  } else {
    logger.info(
      `No users found for tenant. Agreement ${agreement.id}, no emails to dispatch.`
    );
  }

  if (consumerEmail) {
    toDispatch.push({
      correlationId: correlationId ?? generateId<CorrelationId>(),
      email: {
        subject: `Richiesta di fruizione ${agreement.id} attiva`,
        body: templateService.compileHtml(htmlTemplate, {
          title: "Nuova richiesta di fruizione",
          interopFeUrl: `https://${interopFeBaseUrl}/ui/it/fruizione/richieste/${agreement.id}`,
          producerName: producer.name,
          consumerName: consumer.name,
          eserviceName: eservice.name,
          eserviceVersion: descriptor.version,
          rejectionDate,
        }),
      },
      address: consumerEmail.address,
    });
  } else {
    logger.warn(
      `No consumer email found for agreement ${agreement.id}. No email to dispatch.`
    );
  }

  return toDispatch;
}
