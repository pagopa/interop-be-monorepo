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
  getRecipientsForTenants,
  mapRecipientToEmailPayload,
} from "../handlerCommons.js";
import { config } from "../../config/config.js";
import { HandlerCommonParams } from "../../models/handlerParams.js";
import { ClientV2 } from "pagopa-interop-models";

const notificationType: NotificationType = "clientCreatedDeletedToTenantUsers";

export type ClientDeletedHandlerParams = HandlerCommonParams & {
  clientV2Msg?: ClientV2;
};

export async function handleClientDeleted(
  data: ClientDeletedHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    clientV2Msg,
    readModelService,
    logger,
    templateService,
    correlationId,
  } = data;

  if (!clientV2Msg) {
    throw missingKafkaMessageDataError("client", "ClientDeleted");
  }

  const client = fromClientV2(clientV2Msg);

  const [htmlTemplate, consumer] = await Promise.all([
    retrieveHTMLTemplate(eventMailTemplateType.clientDeletedMailTemplate),
    retrieveTenant(client.consumerId, readModelService),
  ]);

  const targets = await getRecipientsForTenants({
    tenants: [consumer],
    notificationType,
    readModelService,
    logger,
    includeTenantContactEmails: false,
  });

  if (targets.length === 0) {
    logger.info(
      `No targets found for tenant. Client ${client.id}, no emails to dispatch.`
    );
    return [];
  }

  return targets.map((t) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `Client "${client.name}" eliminato`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `Client "${client.name}" eliminato`,
        notificationType,
        entityId: client.id,
        ...(t.type === "Tenant" ? { recipientName: consumer.name } : {}),
        clientName: client.name,
        bffUrl: config.bffUrl,
      }),
    },
    tenantId: t.tenantId,
    ...mapRecipientToEmailPayload(t),
  }));
}
