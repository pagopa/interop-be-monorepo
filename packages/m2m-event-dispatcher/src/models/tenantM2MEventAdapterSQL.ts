import { TenantM2MEvent, dateToString } from "pagopa-interop-models";
import { TenantM2MEventSQL } from "pagopa-interop-m2m-event-db-models";

export function toTenantM2MEventSQL(event: TenantM2MEvent): TenantM2MEventSQL {
  return {
    id: event.id,
    eventType: event.eventType,
    eventTimestamp: dateToString(event.eventTimestamp),
    resourceVersion: event.resourceVersion,
    tenantId: event.tenantId,
  };
}
