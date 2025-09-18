/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
import {
  EmailNotificationMessagePayload,
  fromPurposeV2,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
} from "pagopa-interop-models";
import {
  getRecipientsForTenants,
  PurposeHandlerParams,
} from "../handlerCommons.js";
import {
  eventMailTemplateType,
  retrieveEService,
  retrieveHTMLTemplate,
  retrieveTenant,
} from "../../services/utils.js";

const notificationType: NotificationType =
  "purposeSuspendedUnsuspendedToConsumer";

export async function handlePurposeVersionUnsuspendedByProducer(
  data: PurposeHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    purposeV2Msg,
    readModelService,
    logger,
    templateService,
    userService,
    correlationId,
  } = data;

  if (!purposeV2Msg) {
    throw missingKafkaMessageDataError(
      "purpose",
      "PurposeVersionUnsuspendedByProducer"
    );
  }

  const purpose = fromPurposeV2(purposeV2Msg);

  const [htmlTemplate, eservice, consumer] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.purposeVersionUnsuspendedByProducerMailTemplate
    ),
    retrieveEService(purpose.eserviceId, readModelService),
    retrieveTenant(purpose.consumerId, readModelService),
  ]);

  const producer = await retrieveTenant(eservice.producerId, readModelService);

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
      `No targets found for tenant. Purpose ${purpose.id}, no emails to dispatch.`
    );
    return [];
  }

  return targets.map(({ address }) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `Riattivazione della finalità "${purpose.title}"`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `Riattivazione della finalità "${purpose.title}"`,
        notificationType,
        entityId: purpose.id,
        consumerName: consumer.name,
        producerName: producer.name,
        eserviceName: eservice.name,
        purposeTitle: purpose.title,
      }),
    },
    address,
  }));
}
