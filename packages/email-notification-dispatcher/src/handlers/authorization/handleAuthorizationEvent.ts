import {
  AuthorizationEventV2,
  EmailNotificationMessagePayload,
  EServiceId,
  PurposeId,
  unsafeBrandId,
  UserId,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { HandlerParams } from "../../models/handlerParams.js";
import { handleProducerKeychainKeyDeleted } from "./handleProducerKeychainKeyDeleted.js";
import { handleClientKeyDeleted } from "./handleClientKeyDeleted.js";
import { handleClientUserDeleted } from "./handleClientUserDeleted.js";
import { handleProducerKeychainUserDeleted } from "./handleProducerKeychainUserDeleted.js";
import { handleClientKeyAdded } from "./handleClientKeyAdded.js";
import { handleClientPurposeAdded } from "./handleClientPurposeAddedEvent.js";
import { handleClientPurposeRemoved } from "./handleClientPurposeRemovedEvent.js";
import { handleProducerKeychainEserviceAdded } from "./handleProducerKeychainEserviceAdded.js";
import { handleProducerKeychainKeyAdded } from "./handleProducerKeychainKeyAdded.js";
import { handleClientCreated } from "./handleClientCreated.js";
import { handleClientDeleted } from "./handleClientDeleted.js";

export async function handleAuthorizationEvent(
  params: HandlerParams<typeof AuthorizationEventV2>
): Promise<EmailNotificationMessagePayload[]> {
  const {
    decodedMessage,
    logger,
    readModelService,
    templateService,
    correlationId,
  } = params;
  return match(decodedMessage)
    .with(
      {
        type: P.union(
          "ProducerKeychainEServiceAdded",
          "ProducerKeychainEServiceRemoved"
        ),
      },
      ({ data: { eserviceId } }) =>
        handleProducerKeychainEserviceAdded({
          eserviceId: unsafeBrandId<EServiceId>(eserviceId),
          logger,
          readModelService,
          templateService,
          correlationId,
        })
    )
    .with(
      { type: "ProducerKeychainKeyDeleted" },
      ({ data: { producerKeychain, kid } }) =>
        handleProducerKeychainKeyDeleted({
          producerKeychainV2Msg: producerKeychain,
          kid,
          logger,
          readModelService,
          templateService,
          correlationId,
        })
    )
    .with({ type: "ClientKeyDeleted" }, ({ data: { client, kid } }) =>
      handleClientKeyDeleted({
        clientV2Msg: client,
        kid,
        logger,
        readModelService,
        templateService,
        correlationId,
      })
    )
    .with(
      { type: "ProducerKeychainUserDeleted" },
      ({ data: { producerKeychain, userId } }) =>
        handleProducerKeychainUserDeleted({
          producerKeychainV2Msg: producerKeychain,
          userId: unsafeBrandId<UserId>(userId),
          logger,
          readModelService,
          templateService,
          correlationId,
        })
    )
    .with({ type: "ClientUserDeleted" }, ({ data: { client, userId } }) =>
      handleClientUserDeleted({
        clientV2Msg: client,
        userId: unsafeBrandId<UserId>(userId),
        logger,
        readModelService,
        templateService,
        correlationId,
      })
    )
    .with(
      { type: "ProducerKeychainKeyAdded" },
      ({ data: { producerKeychain, kid } }) =>
        handleProducerKeychainKeyAdded({
          producerKeychainV2Msg: producerKeychain,
          kid,
          logger,
          readModelService,
          templateService,
          correlationId,
        })
    )
    .with({ type: "ClientKeyAdded" }, ({ data: { client, kid } }) =>
      handleClientKeyAdded({
        clientV2Msg: client,
        kid,
        logger,
        readModelService,
        templateService,
        correlationId,
      })
    )
    .with({ type: "ClientPurposeAdded" }, ({ data: { purposeId } }) =>
      handleClientPurposeAdded({
        purposeId: unsafeBrandId<PurposeId>(purposeId),
        logger,
        readModelService,
        templateService,
        correlationId,
      })
    )
    .with({ type: "ClientPurposeRemoved" }, ({ data: { purposeId } }) =>
      handleClientPurposeRemoved({
        purposeId: unsafeBrandId<PurposeId>(purposeId),
        logger,
        readModelService,
        templateService,
        correlationId,
      })
    )
    .with({ type: "ClientAdded" }, ({ data: { client } }) =>
      handleClientCreated({
        clientV2Msg: client,
        logger,
        readModelService,
        templateService,
        correlationId,
      })
    )
    .with({ type: "ClientDeleted" }, ({ data: { client } }) =>
      handleClientDeleted({
        clientV2Msg: client,
        logger,
        readModelService,
        templateService,
        correlationId,
      })
    )
    .with(
      {
        type: P.union(
          "ClientAdminSet",
          "ClientUserAdded",
          "ClientAdminRoleRevoked",
          "ClientAdminRemoved",
          "ProducerKeychainAdded",
          "ProducerKeychainDeleted",
          "ProducerKeychainUserAdded",
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
