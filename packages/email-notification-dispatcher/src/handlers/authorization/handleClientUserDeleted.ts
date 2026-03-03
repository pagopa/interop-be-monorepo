import {
  EmailNotificationMessagePayload,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
  fromClientV2,
  clientKind,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  eventMailTemplateType,
  retrieveHTMLTemplate,
  retrieveTenant,
} from "../../services/utils.js";
import {
  ClientUserHandlerParams,
  getRecipientsForTenants,
  mapRecipientToEmailPayload,
} from "../handlerCommons.js";
import { config } from "../../config/config.js";

export async function handleClientUserDeleted(
  data: ClientUserHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    clientV2Msg,
    userId,
    readModelService,
    logger,
    templateService,
    correlationId,
  } = data;

  if (!clientV2Msg) {
    throw missingKafkaMessageDataError("client", "ClientUserDeleted");
  }

  const client = fromClientV2(clientV2Msg);
  const notificationType: NotificationType = match(client.kind)
    .with(
      clientKind.consumer,
      () => "clientKeyConsumerAddedDeletedToClientUsers" as const
    )
    .with(clientKind.api, () => "clientKeyAddedDeletedToClientUsers" as const)
    .exhaustive();

  const [htmlTemplate, consumer] = await Promise.all([
    retrieveHTMLTemplate(eventMailTemplateType.clientUserDeletedMailTemplate),
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
  ).filter((target) => target.type !== "User" || target.userId !== userId);

  if (targets.length === 0) {
    logger.info(
      `No targets found for tenant. Client ${client.id}, user ${userId}, no emails to dispatch.`
    );
    return [];
  }

  return targets.map((t) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `Attenzione: una chiave non è più sicura`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `Attenzione: una chiave non è più sicura`,
        notificationType,
        entityId: client.id,
        ...(t.type === "Tenant" ? { recipientName: consumer.name } : {}),
        clientName: client.name,
        selfcareId: t.selfcareId,
        bffUrl: config.bffUrl,
      }),
    },
    tenantId: t.tenantId,
    ...mapRecipientToEmailPayload(t),
  }));
}
