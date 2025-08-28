import {
  fromEServiceV2,
  EmailNotificationMessagePayload,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  retrieveHTMLTemplate,
  retrieveLatestPublishedDescriptor,
} from "../../services/utils.js";
import {
  EServiceHandlerParams,
  getConsumerRepicientsForAgreements,
} from "../handlerCommons.js";

const notificationType: NotificationType =
  "purposeSuspendedUnsuspendedToConsumer";

export async function handleEserviceDescriptorPublished(
  data: EServiceHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    eserviceV2Msg,
    readModelService,
    logger,
    templateService,
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
    return [];
  }

  const targets = await getConsumerRepicientsForAgreements({
    agreements,
    readModelService,
    logger,
  });

  if (targets.length === 0) {
    logger.info(
      `No targets found. Eservice ${eservice.id}, no emails to dispatch.`
    );
    return [];
  }

  return targets.map(({ address }) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `Nuova versione dell'eservice ${eservice.name} da parte dell'erogatore`,
      body: templateService.compileHtml(htmlTemplate, {
        title: "Nuova versione di un e-service",
        notificationType,
        entityId: descriptor.id,
        eserviceName: eservice.name,
      }),
    },
    address,
  }));
}
