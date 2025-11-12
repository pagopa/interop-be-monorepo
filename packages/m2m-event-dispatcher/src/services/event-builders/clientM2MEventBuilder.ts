import {
  Client,
  ClientM2MEvent,
  m2mEventVisibility,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { generateM2MEventId } from "../../utils/uuidv7.js";

export function createClientM2MEvent(
  client: Client,
  resourceVersion: number,
  eventType: ClientM2MEvent["eventType"],
  eventTimestamp: Date
): ClientM2MEvent {
  return {
    id: generateM2MEventId(),
    eventType,
    eventTimestamp,
    resourceVersion,
    clientId: client.id,
    consumerId: client.consumerId,
    visibility: getClientM2MEventVisibility(eventType),
  };
}

/**
 * Helper function to determine the visibility of a ClientM2MEvent,
 * based on the event type;
 */
function getClientM2MEventVisibility(
  eventType: ClientM2MEvent["eventType"]
): ClientM2MEvent["visibility"] {
  return match(eventType)
    .with(
      P.union("ClientAdded", "ClientDeleted"),
      () => m2mEventVisibility.public
    )
    .with(
      P.union("ClientPurposeAdded", "ClientPurposeRemoved"),
      () => m2mEventVisibility.owner
    )
    .exhaustive();
}
