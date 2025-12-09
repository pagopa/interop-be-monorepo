import {
  AuthorizationEventEnvelopeV2,
  fromClientV2,
  missingKafkaMessageDataError,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { NewNotification } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { clientKeyNotFound } from "../../models/errors.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";
import { getNotificationRecipients } from "../handlerCommons.js";

type ClientKeyAddedDeletedToClientUsersEventType =
  | "ClientKeyAdded"
  | "ClientKeyDeleted"
  | "ClientUserDeleted";

type ClientKeyAddedDeletedToClientUsersEvent = Extract<
  AuthorizationEventEnvelopeV2,
  { type: ClientKeyAddedDeletedToClientUsersEventType }
>;

export async function handleClientKeyAddedDeletedToClientUsers(
  decodedMessage: ClientKeyAddedDeletedToClientUsersEvent,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  if (!decodedMessage.data.client) {
    throw missingKafkaMessageDataError("client", decodedMessage.type);
  }

  logger.info(
    `Sending in-app notification for handleClientKeyAddedDeletedToClientUsers ${decodedMessage.data.client.id} eventType ${decodedMessage.type}`
  );

  const client = fromClientV2(decodedMessage.data.client);

  const usersWithNotifications = await getNotificationRecipients(
    [client.consumerId],
    "clientKeyAddedDeletedToClientUsers",
    readModelService,
    logger
  );
  if (usersWithNotifications.length === 0) {
    logger.info(
      `No users with notifications enabled for clientKeyAddedDeletedToClientUsers message`
    );
    return [];
  }

  return match(decodedMessage)
    .with({ type: "ClientKeyDeleted" }, ({ data: { kid } }) => {
      const key = client.keys.find((key) => key.kid === kid);
      if (!key) {
        throw clientKeyNotFound(client.id, kid);
      }

      return usersWithNotifications
        .filter(({ userId }) => userId !== key.userId) // Send to all other users
        .map(({ userId, tenantId }) => ({
          userId,
          tenantId,
          body: inAppTemplates.clientKeyDeletedToClientUsers(
            client.name,
            key.userId
          ),
          notificationType: "clientKeyAddedDeletedToClientUsers" as const,
          entityId: client.id,
        }));
    })
    .with({ type: "ClientKeyAdded" }, () =>
      usersWithNotifications.map(({ userId, tenantId }) => ({
        userId,
        tenantId,
        body: inAppTemplates.clientKeyAddedToClientUsers(client.name),
        notificationType: "clientKeyAddedDeletedToClientUsers" as const,
        entityId: client.id,
      }))
    )
    .with({ type: "ClientUserDeleted" }, ({ data: { userId } }) =>
      usersWithNotifications
        .filter(({ userId: uid }) => uid !== userId) // Send to all other users
        .map(({ userId, tenantId }) => ({
          userId,
          tenantId,
          body: inAppTemplates.clientUserDeletedToClientUsers(client.name),
          notificationType: "clientKeyAddedDeletedToClientUsers" as const,
          entityId: client.id,
        }))
    )
    .exhaustive();
}
