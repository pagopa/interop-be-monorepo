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

const notificationType: NotificationType = "clientKeyAddedDeletedToClientUsers";

export async function handleClientKeyDeleted(
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
    throw missingKafkaMessageDataError("client", "ClientKeyDeleted");
  }

  const client = fromClientV2(clientV2Msg);

  const [htmlTemplate, consumer] = await Promise.all([
    retrieveHTMLTemplate(eventMailTemplateType.clientKeyDeletedMailTemplate),
    retrieveTenant(client.consumerId, readModelService),
  ]);

  // Get remaining key owners (the deleted key is no longer in client.keys)
  const remainingKeyOwnerIds = client.keys.map((k) => k.userId);

  const targets = (
    await getRecipientsForTenants({
      tenants: [consumer],
      notificationType,
      readModelService,
      logger,
      includeTenantContactEmails: false,
    })
  ).filter(
    (target) =>
      target.type !== "User" || remainingKeyOwnerIds.includes(target.userId)
  );

  if (targets.length === 0) {
    logger.info(
      `No targets found for tenant. Client ${client.id}, key ${kid}, no emails to dispatch.`
    );
    return [];
  }

  return targets.map((t) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `Una chiave di e-service è stata rimossa`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `Una chiave di e-service è stata rimossa`,
        notificationType,
        entityId: client.id,
        ...(t.type === "Tenant" ? { recipientName: consumer.name } : {}),
        keyId: kid,
        clientName: client.name,
      }),
    },
    tenantId: t.tenantId,
    ...mapRecipientToEmailPayload(t),
  }));
}
