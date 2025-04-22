import { AuthorizationEventEnvelopeV2 } from "pagopa-interop-models";
import { match, P } from "ts-pattern";

export async function handleAuthorizationEventMessageV2(
  decodedMessage: AuthorizationEventEnvelopeV2
): Promise<void> {
  await match(decodedMessage)
    .with(
      {
        type: P.union(
          "ClientAdded",
          "ClientDeleted",
          "ClientKeyAdded",
          "ClientKeyDeleted",
          "ClientUserAdded",
          "ClientUserDeleted",
          "ClientAdminRemoved",
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
