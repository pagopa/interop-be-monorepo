import { PurposeTemplateM2MEventSQL } from "pagopa-interop-m2m-event-db-models";
import { PurposeTemplateM2MEvent } from "pagopa-interop-models";

export function fromPurposeTemplateM2MEventSQL(
  event: PurposeTemplateM2MEventSQL
): PurposeTemplateM2MEvent {
  return PurposeTemplateM2MEvent.parse({
    ...event,
    eserviceId: event.eserviceId ?? undefined,
    descriptorId: event.descriptorId ?? undefined,
  });
}
