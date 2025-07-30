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
  retrieveAgreementDescriptor,
  retrieveAgreementEservice,
  retrieveHTMLTemplate,
  retrieveTenant,
} from "../../services/utils.js";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";

export type AgreementActivatedData = {
  agreementV2Msg?: AgreementV2;
  readModelService: ReadModelServiceSQL;
  logger: Logger;
  templateService: HtmlTemplateService;
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

  const activationDate = getFormattedAgreementStampDate(
    agreement,
    "activation"
  );

  const descriptor = retrieveAgreementDescriptor(eservice, agreement);

  return [
    {
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
      address: consumerEmail.address,
    },
  ];
}
