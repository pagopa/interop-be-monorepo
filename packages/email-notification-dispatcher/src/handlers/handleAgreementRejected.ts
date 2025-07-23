import {
  getLatestTenantMailOfKind,
  HtmlTemplateService,
  Logger,
} from "pagopa-interop-commons";
import {
  tenantMailKind,
  EmailNotificationMessagePayload,
  generateId,
  CorrelationId,
  missingKafkaMessageDataError,
  AgreementV2,
  fromAgreementV2,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  getFormattedAgreementStampDate,
  retrieveAgreementEservice,
  retrieveHTMLTemplate,
  retrieveTenant,
} from "../services/utils.js";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";

export type AgreementRejectedData = {
  agreementV2Msg?: AgreementV2;
  readModelService: ReadModelServiceSQL;
  logger: Logger;
  templateService: HtmlTemplateService;
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
    interopFeBaseUrl,
    correlationId,
  } = data;

  if (!agreementV2Msg) {
    throw missingKafkaMessageDataError("eservice", "AgreementRejected");
  }

  const agreement = fromAgreementV2(agreementV2Msg);

  const [htmlTemplate, eservice, producer, consumer] = await Promise.all([
    retrieveHTMLTemplate(eventMailTemplateType.agreementActivatedMailTemplate),
    retrieveAgreementEservice(agreement, readModelService),
    retrieveTenant(agreement.producerId, readModelService),
    retrieveTenant(agreement.consumerId, readModelService),
  ]);

  const consumerEmail = getLatestTenantMailOfKind(
    consumer.mails,
    tenantMailKind.ContactEmail
  );

  if (!consumerEmail) {
    logger.warn(
      `Consumer email not found for agreement ${agreement.id}, skipping email`
    );
    return [];
  }

  const rejectionDate = getFormattedAgreementStampDate(agreement, "rejection");

  return [
    {
      correlationId: correlationId ?? generateId(),
      email: {
        subject: `Richiesta di fruizione per ${eservice.name} rifiutata`,
        body: templateService.compileHtml(htmlTemplate, {
          title: "Nuova richiesta di fruizione",
          interopFeUrl: `https://${interopFeBaseUrl}/ui/it/fruizione/richieste/${agreement.id}`,
          producerName: producer.name,
          consumerName: consumer.name,
          eserviceName: eservice.name,
          rejectionDate,
        }),
      },
      address: consumerEmail.address,
    },
  ];
}
