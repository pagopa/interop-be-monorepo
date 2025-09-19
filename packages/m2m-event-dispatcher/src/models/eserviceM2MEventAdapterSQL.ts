import {
  EServiceM2MEvent,
  dateToString,
  m2mEventVisibility,
} from "pagopa-interop-models";
import { EServiceM2MEventSQL } from "pagopa-interop-m2m-event-db-models";
import { match } from "ts-pattern";
import { generateM2MEventId } from "../utils/uuidv7.js";

export function toEServiceM2MEventSQL(
  event: EServiceM2MEvent
): EServiceM2MEventSQL {
  const visibilityFields = match(event)
    .with({ visibility: m2mEventVisibility.public }, (e) => ({
      visibility: e.visibility,
      producerId: null,
      producerDelegateId: null,
      producerDelegationId: null,
    }))
    .with({ visibility: m2mEventVisibility.restricted }, (e) => ({
      visibility: e.visibility,
      producerId: e.producerId,
      producerDelegateId: e.producerDelegateId ?? null,
      producerDelegationId: e.producerDelegationId ?? null,
    }))
    .exhaustive();

  return {
    id: generateM2MEventId(),
    eventType: event.eventType,
    eventTimestamp: dateToString(event.eventTimestamp),
    eserviceId: event.eserviceId,
    descriptorId: event.descriptorId ?? null,
    ...visibilityFields,
  };
}
