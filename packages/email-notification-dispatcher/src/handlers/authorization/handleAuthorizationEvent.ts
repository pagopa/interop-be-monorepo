import {
  AuthorizationEventV2,
  EmailNotificationMessagePayload,
  PurposeId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { HandlerParams } from "../../models/handlerParams.js";
import { handleClientPurposeAdded } from "./handleClientPurposeAddedEvent.js";
import { handleClientPurposeRemoved } from "./handleClientPurposeRemovedEvent.js";

export async function handleAuthorizationEvent(
  params: HandlerParams<typeof AuthorizationEventV2>
): Promise<EmailNotificationMessagePayload[]> {
  const {
    decodedMessage,
    logger,
    readModelService,
    templateService,
    userService,
    correlationId,
  } = params;
  return match(decodedMessage)
    .with({ type: "ClientPurposeAdded" }, ({ data: { purposeId } }) =>
      handleClientPurposeAdded({
        purposeId: unsafeBrandId<PurposeId>(purposeId),
        logger,
        readModelService,
        templateService,
        userService,
        correlationId,
      })
    )
    .with({ type: "ClientPurposeRemoved" }, ({ data: { purposeId } }) =>
      handleClientPurposeRemoved({
        purposeId: unsafeBrandId<PurposeId>(purposeId),
        logger,
        readModelService,
        templateService,
        userService,
        correlationId,
      })
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
          "ProducerKeychainKeyDeleted",
          "ProducerKeychainUserAdded",
          "ProducerKeychainUserDeleted",
          "ProducerKeychainEServiceAdded",
          "ProducerKeychainEServiceRemoved"
        ),
      },
      () => {
        logger.info(
          `No need to send an email notification for ${decodedMessage.type} message`
        );
        return [];
      }
    )
    .exhaustive();
}
