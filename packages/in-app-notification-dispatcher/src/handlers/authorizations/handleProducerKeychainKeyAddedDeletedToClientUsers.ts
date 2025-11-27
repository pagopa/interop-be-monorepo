import {
  AuthorizationEventEnvelopeV2,
  fromProducerKeychainV2,
  missingKafkaMessageDataError,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { NewNotification } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { producerKeychainKeyNotFound } from "../../models/errors.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";
import { getNotificationRecipients } from "../handlerCommons.js";

type ProducerKeychainKeyAddedDeletedToClientUsersEventType =
  | "ProducerKeychainKeyAdded"
  | "ProducerKeychainKeyDeleted"
  | "ProducerKeychainUserDeleted";

type ProducerKeychainKeyAddedDeletedToClientUsersEvent = Extract<
  AuthorizationEventEnvelopeV2,
  { type: ProducerKeychainKeyAddedDeletedToClientUsersEventType }
>;

export async function handleProducerKeychainKeyAddedDeletedToClientUsers(
  decodedMessage: ProducerKeychainKeyAddedDeletedToClientUsersEvent,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  if (!decodedMessage.data.producerKeychain) {
    throw missingKafkaMessageDataError("producerKeychain", decodedMessage.type);
  }

  logger.info(
    `Sending in-app notification for handleProducerKeychainKeyAddedDeletedToClientUsers ${decodedMessage.data.producerKeychain.id} eventType ${decodedMessage.type}`
  );

  const producerKeychain = fromProducerKeychainV2(
    decodedMessage.data.producerKeychain
  );
  const usersWithNotifications = await getNotificationRecipients(
    [producerKeychain.producerId],
    "producerKeychainKeyAddedDeletedToClientUsers",
    readModelService,
    logger
  );
  if (usersWithNotifications.length === 0) {
    logger.info(
      `No users with notifications enabled for producerKeychainKeyAddedDeletedToClientUsers message`
    );
    return [];
  }

  return match(decodedMessage)
    .with({ type: "ProducerKeychainKeyDeleted" }, ({ data: { kid } }) => {
      const key = producerKeychain.keys.find((key) => key.kid === kid);
      if (!key) {
        throw producerKeychainKeyNotFound(producerKeychain.id, kid);
      }

      return usersWithNotifications
        .filter(({ userId }) => userId !== key.userId) // Send to all other users
        .map(({ userId, tenantId }) => ({
          userId,
          tenantId,
          body: inAppTemplates.producerKeychainKeyDeletedToClientUsers(
            producerKeychain.name,
            key.userId
          ),
          notificationType:
            "producerKeychainKeyAddedDeletedToClientUsers" as const,
          entityId: producerKeychain.id,
        }));
    })
    .with({ type: "ProducerKeychainKeyAdded" }, () =>
      usersWithNotifications.map(({ userId, tenantId }) => ({
        userId,
        tenantId,
        body: inAppTemplates.producerKeychainKeyAddedToClientUsers(
          producerKeychain.name
        ),
        notificationType:
          "producerKeychainKeyAddedDeletedToClientUsers" as const,
        entityId: producerKeychain.id,
      }))
    )
    .with({ type: "ProducerKeychainUserDeleted" }, ({ data: { userId } }) =>
      usersWithNotifications
        .filter(({ userId: uid }) => uid !== userId) // Send to all other users
        .map(({ userId, tenantId }) => ({
          userId,
          tenantId,
          body: inAppTemplates.producerKeychainUserDeletedToClientUsers(
            producerKeychain.name
          ),
          notificationType:
            "producerKeychainKeyAddedDeletedToClientUsers" as const,
          entityId: producerKeychain.id,
        }))
    )
    .exhaustive();
}
