import {
  getLatestTenantMailOfKind,
  HtmlTemplateService,
  Logger,
} from "pagopa-interop-commons";
import {
  EServiceV2,
  fromEServiceV2,
  tenantMailKind,
  EmailNotificationMessagePayload,
  generateId,
  CorrelationId,
  missingKafkaMessageDataError,
  TenantMail,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  retrieveHTMLTemplate,
  retrieveLatestPublishedDescriptor,
  retrieveTenant,
} from "../../services/utils.js";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";

export type EServiceDescriptorPublishedData = {
  eserviceV2Msg?: EServiceV2;
  readModelService: ReadModelServiceSQL;
  logger: Logger;
  templateService: HtmlTemplateService;
  interopFeBaseUrl: string;
  correlationId?: CorrelationId;
};

export async function handleEserviceDescriptorPublished(
  data: EServiceDescriptorPublishedData
): Promise<EmailNotificationMessagePayload[]> {
  const {
    eserviceV2Msg,
    readModelService,
    logger,
    templateService,
    interopFeBaseUrl,
    correlationId,
  } = data;

  if (!eserviceV2Msg) {
    throw missingKafkaMessageDataError(
      "eservice",
      "EServiceDescriptorPublished"
    );
  }

  const eservice = fromEServiceV2(eserviceV2Msg);

  const [htmlTemplate, agreements, descriptor] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.eserviceDescriptorPublishedMailTemplate
    ),
    readModelService.getAgreementsByEserviceId(eservice.id),
    retrieveLatestPublishedDescriptor(eservice),
  ]);

  if (!agreements || agreements.length === 0) {
    logger.warn(
      `Agreement not found for eservice ${eservice.id}, skipping email`
    );
  }

  const consumers = await Promise.all(
    (agreements ?? []).map((consumer) =>
      retrieveTenant(consumer.consumerId, readModelService)
    )
  );

  return (
    consumers
      .map((consumer) =>
        getLatestTenantMailOfKind(consumer.mails, tenantMailKind.ContactEmail)
      )
      // Skip and log consumers with no mail
      .filter((consumerEmail): consumerEmail is TenantMail => {
        if (!consumerEmail) {
          logger.warn(
            `Consumer email not found for eservice ${eservice.id}, skipping email`
          );
        }
        return consumerEmail !== undefined;
      })
      // Map to message payload
      .map((consumerEmail) => ({
        correlationId: correlationId ?? generateId(),
        email: {
          subject: `Nuova versione dell'eservice ${eservice.name} da parte dell'erogatore`,
          body: templateService.compileHtml(htmlTemplate, {
            title: "Nuova versione di un e-service",
            interopFeUrl: `https://${interopFeBaseUrl}/ui/it/fruizione/catalogo-e-service/${eservice.id}/${descriptor.id}`,
            eserviceName: eservice.name,
          }),
        },
        address: consumerEmail.address,
      }))
  );
}
