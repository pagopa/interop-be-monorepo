import {
  EmailNotificationMessagePayload,
  generateId,
  missingKafkaMessageDataError,
  fromAgreementV2,
  NotificationType,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  retrieveHTMLTemplate,
  retrieveTenant,
} from "../../services/utils.js";
import {
  AgreementHandlerParams,
  getRecipientsForTenants,
  retrieveAgreementEservice,
} from "../handlerCommons.js";

const notificationType: NotificationType =
  "agreementSuspendedUnsuspendedToConsumer";

export async function handleAgreementSuspendedByPlatformToConsumer(
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
    throw missingKafkaMessageDataError(
      "agreement",
      "AgreementSuspendedByPlatform"
    );
  }

  const agreement = fromAgreementV2(agreementV2Msg);

  const [htmlTemplate, eservice, consumer] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.agreementSuspendedByPlatformToConsumerMailTemplate
    ),
    retrieveAgreementEservice(agreement, readModelService),
    retrieveTenant(agreement.consumerId, readModelService),
  ]);

  const targets = await getRecipientsForTenants({
    tenants: [consumer],
    notificationType,
    readModelService,
    userService,
    logger,
    includeTenantContactEmails: false,
  });

  if (targets.length === 0) {
    logger.info(
      `No targets found for tenant. Agreement ${agreement.id}, no emails to dispatch.`
    );
    return [];
  }

  return targets.map(({ address }) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `Sospensione richiesta di fruizione da parte della Piattaforma`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `Sospensione richiesta di fruizione da parte della Piattaforma`,
        notificationType,
        entityId: agreement.id,
        consumerName: consumer.name,
        eserviceName: eservice.name,
        ctaLabel: `Visualizza richiesta`,
      }),
    },
    address,
  }));
}
