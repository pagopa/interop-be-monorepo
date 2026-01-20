import { randomUUID } from "crypto";
import { match } from "ts-pattern";
import { AuthorizationEventEnvelopeV2 } from "pagopa-interop-models";
import { QueueMessage } from "../../queue-manager/queueMessage.js";
import { AuthorizationEventNotification } from "./authorizationEventNotification.js";
const eventV2TypeMapper = (
  eventType: AuthorizationEventEnvelopeV2["type"]
): string =>
  match(eventType)
    .with("ClientAdded", () => "client-added")
    .with("ClientAdminSet", () => "admin-set")
    .with("ClientDeleted", () => "client-deleted")
    .with("ClientKeyAdded", () => "keys-added")
    .with("ClientKeyDeleted", () => "key-deleted")
    .with("ClientUserAdded", () => "user-added")
    .with("ClientUserDeleted", () => "user-removed")
    .with("ClientPurposeAdded", () => "client-purpose-added")
    .with("ClientPurposeRemoved", () => "client-purpose-removed")
    .with(
      "ClientAdminRoleRevoked",
      "ClientAdminRemoved",
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
  messageUUID: randomUUID(),
  eventJournalPersistenceId: event.stream_id,
  eventJournalSequenceNumber: event.version,
  eventTimestamp: Number(event.log_date),
  kind: eventV2TypeMapper(event.type),
  payload: authorizationEvent,
});
