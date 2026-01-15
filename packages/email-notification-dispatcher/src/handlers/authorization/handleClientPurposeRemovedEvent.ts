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
  mapRecipientToEmailPayload,
} from "../handlerCommons.js";
import { config } from "../../config/config.js";

const notificationType: NotificationType = "clientAddedRemovedToProducer";

export async function handleClientPurposeRemoved(
  data: ClientPurposeHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    purposeId,
    readModelService,
    logger,
    templateService,
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
    logger,
    includeTenantContactEmails: false,
  });

  if (targets.length === 0) {
    logger.info(
      `No targets found for tenant. Purpose ${purpose.id}, no emails to dispatch.`
    );
    return [];
  }

  return targets.map((t) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `Client disassociato da una finalità`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `Client disassociato da una finalità`,
        notificationType,
        entityId: purpose.id,
        consumerName: consumer.name,
        ...(t.type === "Tenant" ? { producerName: producer.name } : {}),
        eserviceName: eservice.name,
        purposeTitle: purpose.title,
        tenantId: producer.id,
        bffUrl: config.bffUrl,
      }),
    },
    tenantId: producer.id,
    ...mapRecipientToEmailPayload(t),
  }));
}
