import {
  AuthorizationEventEnvelopeV2,
  fromProducerKeychainV2,
  missingKafkaMessageDataError,
  NewNotification,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";
import { getNotificationRecipients } from "../handlerCommons.js";

type ProducerKeychainKeyDeletedEvent = Extract<
  AuthorizationEventEnvelopeV2,
  { type: "ProducerKeychainKeyDeleted" }
>;

export async function handleProducerKeychainNoKeysForAsyncEservice(
  decodedMessage: ProducerKeychainKeyDeletedEvent,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  if (!decodedMessage.data.producerKeychain) {
    throw missingKafkaMessageDataError(
      "producerKeychain",
      "ProducerKeychainKeyDeleted"
    );
  }

  const producerKeychain = fromProducerKeychainV2(
    decodedMessage.data.producerKeychain
  );

  if (producerKeychain.keys.length > 0) {
    logger.info(
      `ProducerKeychain ${producerKeychain.id} still has keys, skipping no-keys-for-async-eservice notification`
    );
    return [];
  }

  const asyncEserviceNames: string[] = [];
  for (const eserviceId of producerKeychain.eservices) {
    const eservice = await readModelService.getEServiceById(eserviceId);
    if (eservice && eservice.asyncExchange) {
      asyncEserviceNames.push(eservice.name);
    }
  }

  if (asyncEserviceNames.length === 0) {
    logger.info(
      `ProducerKeychain ${producerKeychain.id} has no async e-services, skipping no-keys-for-async-eservice notification`
    );
    return [];
  }

  const usersWithNotifications = await getNotificationRecipients(
    [producerKeychain.producerId],
    "producerKeychainKeyAddedDeletedToClientUsers",
    readModelService,
    logger
  );

  if (usersWithNotifications.length === 0) {
    logger.info(
      `No users with notifications enabled for producerKeychainNoKeysForAsyncEservice for keychain ${producerKeychain.id}`
    );
    return [];
  }

  const eserviceNamesStr = asyncEserviceNames.join(", ");

  return usersWithNotifications.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body: inAppTemplates.producerKeychainNoKeysForAsyncEserviceToProducerUsers(
      producerKeychain.name,
      eserviceNamesStr
    ),
    notificationType:
      "producerKeychainKeyAddedDeletedToClientUsers" as const,
    entityId: producerKeychain.id,
  }));
}