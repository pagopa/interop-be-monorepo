import { DB } from "pagopa-interop-commons";
import { AuthorizationEventEnvelopeV2 } from "pagopa-interop-models";
import { match } from "ts-pattern";

export async function handleMessageV2(
  message: AuthorizationEventEnvelopeV2,
  db: DB
): Promise<void> {
  await match(message)
    .with(
      { type: "ProducerKeychainKeyDeleted" },
      { type: "ProducerKeychainKeyAdded" },
      async (message) => {
        const kid = message.data.kid;
        const eventType = match(message.type)
          .returnType<"ADDED" | "DELETED">()
          .with("ProducerKeychainKeyAdded", () => "ADDED")
          .with("ProducerKeychainKeyDeleted", () => "DELETED")
          .exhaustive();

        return db.none(
          `INSERT INTO producer_keys_events(kid, event_type) 
           VALUES($1, $2)`,
          [kid, eventType]
        );
      }
    )
    .with(
      { type: "ProducerKeychainDeleted" },
      { type: "ClientAdded" },
      { type: "ClientDeleted" },
      { type: "ClientUserAdded" },
      { type: "ClientUserDeleted" },
      { type: "ClientKeyAdded" },
      { type: "ClientKeyDeleted" },
      { type: "ClientPurposeAdded" },
      { type: "ClientPurposeRemoved" },
      { type: "ProducerKeychainAdded" },
      { type: "ProducerKeychainUserAdded" },
      { type: "ProducerKeychainUserDeleted" },
      { type: "ProducerKeychainEServiceAdded" },
      { type: "ProducerKeychainEServiceRemoved" },
      () => Promise.resolve
    )
    .exhaustive();
}
