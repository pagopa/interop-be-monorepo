import {
  ProducerKeychain,
  ProducerKeychainM2MEvent,
  m2mEventVisibility,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { generateM2MEventId } from "../../utils/uuidv7.js";

export function createProducerKeychainM2MEvent(
  producerKeychain: ProducerKeychain,
  resourceVersion: number,
  eventType: ProducerKeychainM2MEvent["eventType"],
  eventTimestamp: Date
): ProducerKeychainM2MEvent {
  return {
    id: generateM2MEventId(),
    eventType,
    eventTimestamp,
    resourceVersion,
    producerKeychainId: producerKeychain.id,
    producerId: producerKeychain.producerId,
    visibility: getProducerKeychainM2MEventVisibility(eventType),
  };
}

/**
 * Helper function to determine the visibility of a ProducerKeychainM2MEvent,
 * based on the event type;
 */
function getProducerKeychainM2MEventVisibility(
  eventType: ProducerKeychainM2MEvent["eventType"]
): ProducerKeychainM2MEvent["visibility"] {
  return match(eventType)
    .with(
      P.union("ProducerKeychainAdded", "ProducerKeychainDeleted"),
      () => m2mEventVisibility.public
    )
    .with(
      P.union(
        "ProducerKeychainEServiceAdded",
        "ProducerKeychainEServiceRemoved"
      ),
      () => m2mEventVisibility.owner
    )
    .exhaustive();
}
