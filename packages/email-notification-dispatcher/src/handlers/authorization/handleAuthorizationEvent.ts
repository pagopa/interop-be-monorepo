import {
  AuthorizationEventEnvelopeV2,
  CorrelationId,
  EmailNotificationMessagePayload,
} from "pagopa-interop-models";
import { HtmlTemplateService, Logger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";

// const interopFeBaseUrl = config.interopFeBaseUrl;

export async function handleAuthorizationEvent(
  decodedMessage: AuthorizationEventEnvelopeV2,
  _correlationId: CorrelationId,
  logger: Logger,
  _readModelService: ReadModelServiceSQL,
  _templateService: HtmlTemplateService
): Promise<EmailNotificationMessagePayload[]> {
  return match(decodedMessage)
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
          "ClientPurposeAdded",
          "ClientPurposeRemoved",
          "ClientAdminRoleRevoked",
          "ClientAdminRemoved",
          "ProducerKeychainAdded",
          "ProducerKeychainDeleted",
          "ProducerKeychainKeyAdded",
          "ProducerKeychainKeyDeleted",
          "ProducerKeychainUserAdded",
          "ProducerKeychainUserDeleted",
          "ProducerKeychainEServiceAdded",
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
