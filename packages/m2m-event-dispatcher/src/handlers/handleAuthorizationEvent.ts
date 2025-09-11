import { AuthorizationEventEnvelopeV2 } from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import { M2MEventWriterService } from "../services/m2mEventWriterService.js";

export async function handleAuthorizationEvent(
  decodedMessage: AuthorizationEventEnvelopeV2,
  _eventTimestamp: Date,
  _logger: Logger,
  _m2mEventWriterService: M2MEventWriterService,
  _readModelService: ReadModelServiceSQL
): Promise<void> {
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
      () => Promise.resolve(void 0)
    )
    .exhaustive();
}
