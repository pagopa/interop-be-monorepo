import {
  AuthorizationEventEnvelopeV2,
  NewNotification,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { UserServiceSQL } from "../../services/userServiceSQL.js";
import { handleClientAddedRemovedToProducer } from "./handleClientAddedRemovedToProducer.js";
import { handleEserviceStateChangedToConsumer } from "./handleEserviceStateChangedToConsumer.js";

export async function handleAuthorizationEvent(
  decodedMessage: AuthorizationEventEnvelopeV2,
  logger: Logger,
  readModelService: ReadModelServiceSQL,
  userService: UserServiceSQL
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
          userService,
          type
        )
    )
    .with(
      { type: "ProducerKeychainEServiceAdded" },
      ({ data: { eserviceId } }) =>
        handleEserviceStateChangedToConsumer(
          eserviceId,
          logger,
          readModelService,
          userService
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
