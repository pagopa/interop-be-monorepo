import { EServiceTemplateM2MEventSQL } from "pagopa-interop-m2m-event-db-models";
import { EServiceTemplateM2MEvent, dateToString } from "pagopa-interop-models";

export function toEServiceTemplateM2MEventSQL(
  event: EServiceTemplateM2MEvent
): EServiceTemplateM2MEventSQL {
  return {
    id: event.id,
    eventType: event.eventType,
    eventTimestamp: dateToString(event.eventTimestamp),
    resourceVersion: event.resourceVersion,
    eserviceTemplateId: event.eserviceTemplateId,
    eserviceTemplateVersionId: event.eserviceTemplateVersionId ?? null,
    creatorId: event.creatorId,
    visibility: event.visibility,
  };
}
