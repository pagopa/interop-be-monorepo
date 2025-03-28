import { AuthorizationEventEnvelopeV2 } from "pagopa-interop-models";
import { match, P } from "ts-pattern";

export async function handleAuthorizationEventMessageV2(
  decodedMessage: AuthorizationEventEnvelopeV2
): Promise<void> {
  await match(decodedMessage)
    .with(
      P.union(
        { type: "ClientAdded" },
        { type: "ClientDeleted" },
        { type: "ClientKeyAdded" },
        { type: "ClientKeyDeleted" },
        { type: "ClientUserAdded" },
        { type: "ClientUserDeleted" },
        { type: "ClientPurposeAdded" },
        { type: "ClientPurposeRemoved" }
      ),
      async () => Promise.resolve()
    )
    .with(
      P.union(
        { type: "ProducerKeychainAdded" },
        { type: "ProducerKeychainDeleted" },
        { type: "ProducerKeychainKeyAdded" },
        { type: "ProducerKeychainKeyDeleted" },
        { type: "ProducerKeychainUserAdded" },
        { type: "ProducerKeychainUserDeleted" },
        { type: "ProducerKeychainEServiceAdded" },
        { type: "ProducerKeychainEServiceRemoved" }
      ),
      async () => Promise.resolve()
    )
    .exhaustive();
}
