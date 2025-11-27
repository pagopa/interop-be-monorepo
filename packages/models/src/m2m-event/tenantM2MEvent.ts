import { z } from "zod";
import { TenantId, TenantM2MEventId } from "../brandedIds.js";
import { TenantEvent } from "../tenant/tenantEvents.js";

export const TenantM2MEventType = z.enum([
  "TenantOnboarded",
  "TenantOnboardDetailsUpdated",
  "TenantCertifiedAttributeAssigned",
  "TenantCertifiedAttributeRevoked",
  "TenantDeclaredAttributeAssigned",
  "TenantDeclaredAttributeRevoked",
  "TenantVerifiedAttributeAssigned",
  "TenantVerifiedAttributeRevoked",
  "TenantVerifiedAttributeExpirationUpdated",
  "MaintenanceTenantDeleted",
  "TenantMailAdded",
  "TenantVerifiedAttributeExtensionUpdated",
  "MaintenanceTenantPromotedToCertifier",
  "TenantMailDeleted",
  "TenantKindUpdated",
  "TenantDelegatedProducerFeatureAdded",
  "TenantDelegatedProducerFeatureRemoved",
  "MaintenanceTenantUpdated",
  "TenantDelegatedConsumerFeatureAdded",
  "TenantDelegatedConsumerFeatureRemoved",
]);
export type TenantM2MEventType = z.infer<typeof TenantM2MEventType>;

const _: TenantEvent["type"] = {} as TenantM2MEventType;
// ^ Type check: ensure TenantM2MEventType options are a subset of TenantEvent["type"].
//   This is required because Zod does not have an equivalent of TS Extract<...>.

void _; // avoid unused variable TS error, cannot use ts-ignore for a type check

export const TenantM2MEvent = z.object({
  id: TenantM2MEventId,
  eventType: TenantM2MEventType,
  eventTimestamp: z.coerce.date(),
  resourceVersion: z.number().int().min(0),
  tenantId: TenantId,
});

export type TenantM2MEvent = z.infer<typeof TenantM2MEvent>;
