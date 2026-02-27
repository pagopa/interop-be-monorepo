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
  ClientKeyHandlerParams,
  getRecipientsForTenants,
  mapRecipientToEmailPayload,
} from "../handlerCommons.js";
import { clientKeyNotFound } from "../../models/errors.js";
import { config } from "../../config/config.js";

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
  const notificationType: NotificationType = match(client.kind)
    .with(
      clientKind.consumer,
      () => "clientKeyConsumerAddedDeletedToClientUsers" as const
    )
    .with(clientKind.api, () => "clientKeyAddedDeletedToClientUsers" as const)
    .exhaustive();
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
        selfcareId: t.selfcareId,
        bffUrl: config.bffUrl,
      }),
    },
    tenantId: t.tenantId,
    ...mapRecipientToEmailPayload(t),
  }));
}
