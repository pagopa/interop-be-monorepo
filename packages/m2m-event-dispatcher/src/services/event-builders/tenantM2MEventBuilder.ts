import { Tenant, TenantM2MEvent } from "pagopa-interop-models";
import { generateM2MEventId } from "../../utils/uuidv7.js";

export function createTenantM2MEvent(
  tenant: Tenant,
  resourceVersion: number,
  eventType: TenantM2MEvent["eventType"],
  eventTimestamp: Date
): TenantM2MEvent {
  return {
    id: generateM2MEventId(),
    eventType,
    eventTimestamp,
    resourceVersion,
    tenantId: tenant.id,
  };
}
