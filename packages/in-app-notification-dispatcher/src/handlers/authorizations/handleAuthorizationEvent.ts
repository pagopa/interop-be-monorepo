import {
  AuthorizationEventEnvelopeV2,
  NewNotification,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { handleClientAddedRemovedToProducer } from "./handleClientAddedRemovedToProducer.js";
import { handleEserviceStateChangedToConsumer } from "./handleEserviceStateChangedToConsumer.js";
import { handleClientKeyAddedDeletedToClientUsers } from "./handleClientKeyAddedDeletedToClientUsers.js";
import { handleProducerKeychainKeyAddedDeletedToClientUsers } from "./handleProducerKeychainKeyAddedDeletedToClientUsers.js";

export async function handleAuthorizationEvent(
  decodedMessage: AuthorizationEventEnvelopeV2,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  return match(decodedMessage)
    .with(
      {
        type: P.union("ClientPurposeAdded", "ClientPurposeRemoved"),
      },
      ({ data: { purposeId }, type }) =>
        handleClientAddedRemovedToProducer(
          purposeId,
          logger,
          readModelService,
          type
        )
    )
    .with(
      { type: "ProducerKeychainEServiceAdded" },
      ({ data: { eserviceId } }) =>
        handleEserviceStateChangedToConsumer(
          eserviceId,
          logger,
          readModelService
        )
    )
    .with(
      {
        type: P.union(
          "ClientKeyAdded",
          "ClientKeyDeleted",
          "ClientUserDeleted"
        ),
      },
      (msg) =>
        handleClientKeyAddedDeletedToClientUsers(msg, logger, readModelService)
    )
    .with(
      {
        type: P.union(
          "ProducerKeychainKeyAdded",
          "ProducerKeychainKeyDeleted",
          "ProducerKeychainUserDeleted"
        ),
      },
      (msg) =>
        handleProducerKeychainKeyAddedDeletedToClientUsers(
          msg,
          logger,
          readModelService
        )
    )
    .with(
      {
        type: P.union(
          "ClientAdded",
          "ClientAdminSet",
          "ClientDeleted",
          "ClientUserAdded",
          "ClientAdminRoleRevoked",
          "ClientAdminRemoved",
          "ProducerKeychainEServiceRemoved",
          "ProducerKeychainAdded",
          "ProducerKeychainDeleted",
          "ProducerKeychainUserAdded"
        ),
      },
      () => {
        logger.info(
          `No need to send an in-app notification for ${decodedMessage.type} message`
        );
        return [];
      }
    )
    .exhaustive();
}
