import { ProducerKeychain, ProducerKeyM2MEvent } from "pagopa-interop-models";
import { generateM2MEventId } from "../../utils/uuidv7.js";

export function createProducerKeyM2MEvent(
  producerKeychain: ProducerKeychain,
  kid: string,
  resourceVersion: number,
  eventType: ProducerKeyM2MEvent["eventType"],
  eventTimestamp: Date
): ProducerKeyM2MEvent {
  return {
    id: generateM2MEventId(),
    eventType,
    eventTimestamp,
    resourceVersion,
    kid,
    producerKeychainId: producerKeychain.id,
  };
}
