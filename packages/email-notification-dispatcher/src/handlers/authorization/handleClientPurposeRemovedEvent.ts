import {
  EmailNotificationMessagePayload,
  generateId,
  NotificationType,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  retrieveEService,
  retrieveHTMLTemplate,
  retrieveTenant,
} from "../../services/utils.js";
import {
  getRecipientsForTenants,
  ClientPurposeHandlerParams,
  retrievePurpose,
} from "../handlerCommons.js";

const notificationType: NotificationType = "clientAddedRemovedToProducer";

export async function handleClientPurposeRemoved(
  data: ClientPurposeHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    purposeId,
    readModelService,
    logger,
    templateService,
    userService,
    correlationId,
  } = data;

  const purpose = await retrievePurpose(purposeId, readModelService);

  const [htmlTemplate, eservice, consumer] = await Promise.all([
    retrieveHTMLTemplate(
      eventMailTemplateType.clientPurposeRemovedMailTemplate
    ),
    retrieveEService(purpose.eserviceId, readModelService),
    retrieveTenant(purpose.consumerId, readModelService),
  ]);

  const producer = await retrieveTenant(eservice.producerId, readModelService);

  const targets = await getRecipientsForTenants({
    tenants: [producer],
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
      subject: `Client disassociato da una finalità`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `Client disassociato da una finalità`,
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
