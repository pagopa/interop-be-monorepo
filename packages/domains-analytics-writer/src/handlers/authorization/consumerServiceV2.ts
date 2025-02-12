import { AuthorizationEventEnvelopeV2 } from "pagopa-interop-models";
import { match } from "ts-pattern";

export async function handleAuthorizationEventMessageV2(
  decodedMessage: AuthorizationEventEnvelopeV2
): Promise<void> {
  await match(decodedMessage)
    .with({ type: "ClientAdded" }, async () => Promise.resolve())
    .with({ type: "ClientDeleted" }, async () => Promise.resolve())
    .with({ type: "ClientKeyAdded" }, async () => Promise.resolve())
    .with({ type: "ClientKeyDeleted" }, async () => Promise.resolve())
    .with({ type: "ClientUserAdded" }, async () => Promise.resolve())
    .with({ type: "ClientUserDeleted" }, async () => Promise.resolve())
    .with({ type: "ClientPurposeAdded" }, async () => Promise.resolve())
    .with({ type: "ClientPurposeRemoved" }, async () => Promise.resolve())
    .with(
      { type: "ProducerKeychainAdded" },
      { type: "ProducerKeychainDeleted" },
      { type: "ProducerKeychainKeyAdded" },
      { type: "ProducerKeychainKeyDeleted" },
      { type: "ProducerKeychainUserAdded" },
      { type: "ProducerKeychainUserDeleted" },
      { type: "ProducerKeychainEServiceAdded" },
      { type: "ProducerKeychainEServiceRemoved" },
      async () => Promise.resolve()
    )
    .exhaustive();
}
