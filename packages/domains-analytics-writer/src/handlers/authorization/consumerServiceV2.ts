import { AuthorizationEventEnvelopeV2 } from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { DBContext } from "../../db/db.js";

export async function handleAuthorizationEventMessageV2(
  messages: AuthorizationEventEnvelopeV2[],
  _dbContext: DBContext
): Promise<void> {
  for (const message of messages) {
    await match(message)
      .with(
        {
          type: P.union(
            "ClientAdded",
            "ClientDeleted",
            "ClientKeyAdded",
            "ClientKeyDeleted",
            "ClientUserAdded",
            "ClientUserDeleted",
            "ClientPurposeAdded",
            "ClientPurposeRemoved"
          ),
        },
        async () => Promise.resolve()
      )
      .with(
        {
          type: P.union(
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
        async () => Promise.resolve()
      )
      .exhaustive();
  }
}
