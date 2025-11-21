import {
  EmailNotificationMessagePayload,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
  fromClientV2,
} from "pagopa-interop-models";
import {
  eventMailTemplateType,
  retrieveHTMLTemplate,
  retrieveTenant,
} from "../../services/utils.js";
import {
  ClientKeyHandlerParams,
  getRecipientsForTenants,
  mapRecipientToEmailPayload,
} from "../handlerCommons.js";
import { clientKeyNotFound } from "../../models/errors.js";

const notificationType: NotificationType = "clientKeyAddedDeletedToClientUsers";

export async function handleClientKeyAdded(
  data: ClientKeyHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    clientV2Msg,
    kid,
    readModelService,
    logger,
    templateService,
    correlationId,
  } = data;

  if (!clientV2Msg) {
    throw missingKafkaMessageDataError("client", "ClientKeyAdded");
  }

  const client = fromClientV2(clientV2Msg);
  const key = client.keys.find((key) => key.kid === kid);

  if (!key) {
    throw clientKeyNotFound(client.id, kid);
  }

  const [htmlTemplate, consumer] = await Promise.all([
    retrieveHTMLTemplate(eventMailTemplateType.clientKeyAddedMailTemplate),
    retrieveTenant(client.consumerId, readModelService),
  ]);

  const targets = (
    await getRecipientsForTenants({
      tenants: [consumer],
      notificationType,
      readModelService,
      logger,
      includeTenantContactEmails: false,
    })
  ).filter((target) => target.type !== "User" || target.userId !== key.userId);

  if (targets.length === 0) {
    logger.info(
      `No targets found for tenant. Client ${client.id}, key ${kid}, no emails to dispatch.`
    );
    return [];
  }

  return targets.map((t) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `Nuova chiave aggiunta al client "${client.name}"`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `Nuova chiave aggiunta al client "${client.name}"`,
        notificationType,
        entityId: client.id,
        ...(t.type === "Tenant" ? { recipientName: consumer.name } : {}),
        clientName: client.name,
      }),
    },
    tenantId: t.tenantId,
    ...mapRecipientToEmailPayload(t),
  }));
}
