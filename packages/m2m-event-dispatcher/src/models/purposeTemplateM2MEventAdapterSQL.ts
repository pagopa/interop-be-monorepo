import { PurposeTemplateM2MEventSQL } from "pagopa-interop-m2m-event-db-models";
import { PurposeTemplateM2MEvent, dateToString } from "pagopa-interop-models";

export function toPurposeTemplateM2MEventSQL(
  event: PurposeTemplateM2MEvent
): PurposeTemplateM2MEventSQL {
  return {
    id: event.id,
    eventType: event.eventType,
    eventTimestamp: dateToString(event.eventTimestamp),
    resourceVersion: event.resourceVersion,
    purposeTemplateId: event.purposeTemplateId,
    creatorId: event.creatorId,
    visibility: event.visibility,
    eserviceId: event.eserviceId ?? null,
    descriptorId: event.descriptorId ?? null,
  };
}
