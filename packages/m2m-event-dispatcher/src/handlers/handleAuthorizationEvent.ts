import { AuthorizationEventEnvelopeV2 } from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import { M2MEventServiceSQL } from "../services/m2mEventServiceSQL.js";

export async function handleAuthorizationEvent(
  decodedMessage: AuthorizationEventEnvelopeV2,
  _logger: Logger,
  _m2mEventService: M2MEventServiceSQL,
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
