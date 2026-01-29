import {
  AuthorizationEventEnvelopeV2,
  fromClientV2,
  missingKafkaMessageDataError,
  NewNotification,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { getNotificationRecipients } from "../handlerCommons.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";

type ClientCreatedDeletedEventType = "ClientAdded" | "ClientDeleted";

type ClientCreatedDeletedEvent = Extract<
  AuthorizationEventEnvelopeV2,
  { type: ClientCreatedDeletedEventType }
>;

export async function handleClientCreatedDeletedToTenantUsers(
  decodedMessage: ClientCreatedDeletedEvent,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  if (!decodedMessage.data.client) {
    throw missingKafkaMessageDataError("client", decodedMessage.type);
  }

  logger.info(
    `Sending in-app notification for handleClientCreatedDeletedToTenantUsers ${decodedMessage.data.client.id} eventType ${decodedMessage.type}`
  );

  const client = fromClientV2(decodedMessage.data.client);

  const usersWithNotifications = await getNotificationRecipients(
    [client.consumerId],
    "clientCreatedDeletedToTenantUsers",
    readModelService,
    logger
  );

  if (usersWithNotifications.length === 0) {
    logger.info(
      `No users with notifications enabled for clientCreatedDeletedToTenantUsers message`
    );
    return [];
  }

  const body = match(decodedMessage.type)
    .with("ClientAdded", () =>
      inAppTemplates.clientCreatedToTenantUsers(client.name)
    )
    .with("ClientDeleted", () =>
      inAppTemplates.clientDeletedToTenantUsers(client.name)
    )
    .exhaustive();

  return usersWithNotifications.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body,
    notificationType: "clientCreatedDeletedToTenantUsers" as const,
    entityId: client.id,
  }));
}
