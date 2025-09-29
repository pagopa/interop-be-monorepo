import {
  AuthorizationEventEnvelopeV2,
  NewNotification,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { handleClientAddedRemovedToProducer } from "./handleClientAddedRemovedToProducer.js";
import { handleEserviceStateChangedToConsumer } from "./handleEserviceStateChangedToConsumer.js";

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
          "ClientAdded",
          "ClientAdminSet",
          "ClientDeleted",
          "ClientKeyAdded",
          "ClientKeyDeleted",
          "ClientUserAdded",
          "ClientUserDeleted",
          "ClientAdminRoleRevoked",
          "ClientAdminRemoved",
          "ProducerKeychainAdded",
          "ProducerKeychainDeleted",
          "ProducerKeychainKeyAdded",
          "ProducerKeychainKeyDeleted",
          "ProducerKeychainUserAdded",
          "ProducerKeychainUserDeleted",
          "ProducerKeychainEServiceRemoved"
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
