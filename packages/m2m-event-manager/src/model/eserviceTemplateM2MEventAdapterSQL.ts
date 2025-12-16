import { EServiceTemplateM2MEventSQL } from "pagopa-interop-m2m-event-db-models";
import { EServiceTemplateM2MEvent } from "pagopa-interop-models";

export function fromEServiceTemplateM2MEventSQL(
  event: EServiceTemplateM2MEventSQL
): EServiceTemplateM2MEvent {
  return EServiceTemplateM2MEvent.parse({
    ...event,
    eserviceTemplateVersionId: event.eserviceTemplateVersionId ?? undefined,
  });
}
