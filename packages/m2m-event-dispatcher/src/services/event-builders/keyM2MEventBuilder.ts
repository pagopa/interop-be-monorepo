import { KeyM2MEvent } from "pagopa-interop-models";
import { generateM2MEventId } from "../../utils/uuidv7.js";

export function createKeyM2MEvent(
  kid: string,
  resourceVersion: number,
  eventType: KeyM2MEvent["eventType"],
  eventTimestamp: Date
): KeyM2MEvent {
  return {
    id: generateM2MEventId(),
    eventType,
    eventTimestamp,
    resourceVersion,
    kid,
  };
}
