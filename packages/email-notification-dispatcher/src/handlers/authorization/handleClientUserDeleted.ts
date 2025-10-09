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
  ClientUserHandlerParams,
  UserEmailNotificationRecipient,
  getRecipientsForTenants,
} from "../handlerCommons.js";

const notificationType: NotificationType = "clientKeyAddedDeletedToClientUsers";

export async function handleClientUserDeleted(
  data: ClientUserHandlerParams
): Promise<EmailNotificationMessagePayload[]> {
  const {
    clientV2Msg,
    userId,
    readModelService,
    logger,
    templateService,
    userService,
    correlationId,
  } = data;

  if (!clientV2Msg) {
    throw missingKafkaMessageDataError("client", "ClientUserDeleted");
  }

  const client = fromClientV2(clientV2Msg);

  const [htmlTemplate, consumer] = await Promise.all([
    retrieveHTMLTemplate(eventMailTemplateType.clientUserDeletedMailTemplate),
    retrieveTenant(client.consumerId, readModelService),
  ]);

  const targets = (
    await getRecipientsForTenants({
      tenants: [consumer],
      notificationType,
      readModelService,
      userService,
      logger,
      includeTenantContactEmails: false,
    })
  ).filter(
    (target): target is UserEmailNotificationRecipient =>
      target.type === "User" && target.userId !== userId
  );

  if (targets.length === 0) {
    logger.info(
      `No targets found for tenant. Client ${client.id}, user ${userId}, no emails to dispatch.`
    );
    return [];
  }

  return targets.map(({ address }) => ({
    correlationId: correlationId ?? generateId(),
    email: {
      subject: `Attenzione: una chiave non è più sicura`,
      body: templateService.compileHtml(htmlTemplate, {
        title: `Attenzione: una chiave non è più sicura`,
        notificationType,
        entityId: client.id,
        consumerName: consumer.name,
        clientName: client.name,
      }),
    },
    address,
  }));
}
