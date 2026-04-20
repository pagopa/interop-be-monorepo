import {
  AuthorizationEventEnvelopeV2,
  EServiceId,
  fromProducerKeychainV2,
  missingKafkaMessageDataError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { NewNotification } from "pagopa-interop-models";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { inAppTemplates } from "../../templates/inAppTemplates.js";
import {
  getNotificationRecipients,
  retrieveEservice,
} from "../handlerCommons.js";

type AsyncEserviceWithoutKeychainEvent = Extract<
  AuthorizationEventEnvelopeV2,
  { type: "ProducerKeychainEServiceRemoved" }
>;

export async function handleAsyncEserviceWithoutKeychain(
  decodedMessage: AsyncEserviceWithoutKeychainEvent,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  if (!decodedMessage.data.producerKeychain) {
    throw missingKafkaMessageDataError("producerKeychain", decodedMessage.type);
  }

  const producerKeychain = fromProducerKeychainV2(
    decodedMessage.data.producerKeychain
  );
  const eserviceId = unsafeBrandId<EServiceId>(decodedMessage.data.eserviceId);

  const eservice = await retrieveEservice(eserviceId, readModelService);

  if (!eservice.asyncExchange) {
    logger.info(
      `Eservice ${eserviceId} is not async, skipping notification for ProducerKeychainEServiceRemoved`
    );
    return [];
  }

  const eserviceInOtherKeychain =
    await readModelService.eserviceExistsInOtherProducerKeychains(
      eserviceId,
      producerKeychain.producerId,
      producerKeychain.id
    );

  if (eserviceInOtherKeychain) {
    logger.info(
      `Eservice ${eserviceId} still exists in other producer keychains for producer ${producerKeychain.producerId}, skipping notification`
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
    return [];
  }

  return usersWithNotifications.map(({ userId, tenantId }) => ({
    userId,
    tenantId,
    body: inAppTemplates.asyncEserviceWithoutKeychainToProducer(eservice.name),
    notificationType: "producerKeychainKeyAddedDeletedToClientUsers" as const,
    entityId: producerKeychain.id,
  }));
}
