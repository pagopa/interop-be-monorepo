import { TenantM2MEventSQL } from "pagopa-interop-m2m-event-db-models";
import { TenantM2MEvent } from "pagopa-interop-models";

export function fromTenantM2MEventSQL(
  event: TenantM2MEventSQL
): TenantM2MEvent {
  return TenantM2MEvent.parse(event);
}
