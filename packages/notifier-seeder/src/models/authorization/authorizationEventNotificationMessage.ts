import { match } from "ts-pattern";
import { v4 as uuidv4 } from "uuid";
import { AuthorizationEventEnvelopeV2 } from "pagopa-interop-models";
import { QueueMessage } from "../../queue-manager/queueMessage.js";
import { AuthorizationEventNotification } from "./authorizationEventNotification.js";
export const eventV2TypeMapper = (
  eventType: AuthorizationEventEnvelopeV2["type"]
): string =>
  match(eventType)
    .with("ClientAdded", () => "client-added")
    .with("ClientDeleted", () => "client-deleted")
    .with("ClientKeyAdded", () => "keys-added")
    .with("ClientKeyDeleted", () => "key-deleted")
    .with("ClientUserAdded", () => "user-added")
    .with("ClientUserDeleted", () => "user-removed")
    .with("ClientPurposeAdded", () => "client-purpose-added")
    .with("ClientPurposeRemoved", () => "client-purpose-removed")
    .with(
      "ProducerKeychainAdded",
      "ProducerKeychainDeleted",
      "ProducerKeychainKeyAdded",
      "ProducerKeychainKeyDeleted",
      "ProducerKeychainUserAdded",
      "ProducerKeychainUserDeleted",
      "ProducerKeychainEServiceAdded",
      "ProducerKeychainEServiceRemoved",
      () => {
        throw new Error("Not implemented");
      }
    )
    .exhaustive();

export const buildAuthorizationMessage = (
  event: AuthorizationEventEnvelopeV2,
  authorizationEvent: AuthorizationEventNotification
): QueueMessage => ({
  messageUUID: uuidv4(),
  eventJournalPersistenceId: event.stream_id,
  eventJournalSequenceNumber: event.version,
  eventTimestamp: Number(event.log_date),
  kind: eventV2TypeMapper(event.type),
  payload: authorizationEvent,
});
