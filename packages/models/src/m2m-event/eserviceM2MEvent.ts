import { z } from "zod";
import { EServiceEventV2 } from "../eservice/eserviceEvents.js";
import {
  DelegationId,
  DescriptorId,
  EServiceId,
  EServiceM2MEventId,
  TenantId,
} from "../brandedIds.js";
import { m2mEventVisibility } from "./m2mEventVisibility.js";

const EServiceM2MEventType = z.union([
  z.literal("DraftEServiceUpdated"),
  z.literal("EServiceDescriptorPublished"),
  // TODO define missing events
]);
export type EServiceM2MEventType = z.infer<typeof EServiceM2MEventType> &
  EServiceEventV2["type"];
// ^ make sure it's compatible with EServiceEvent types

const EServiceM2MEventFields = z.object({
  id: EServiceM2MEventId,
  eventType: EServiceM2MEventType,
  eventTimestamp: z.coerce.date(),
  eserviceId: EServiceId,
  descriptorId: DescriptorId.optional(),
});

const EServiceM2MEventPublic = EServiceM2MEventFields.extend({
  visibility: z.literal(m2mEventVisibility.public),
});

const EServiceM2MEventRestricted = EServiceM2MEventFields.extend({
  visibility: z.literal(m2mEventVisibility.restricted),
  producerId: TenantId,
  producerDelegateId: TenantId.optional(),
  producerDelegationId: DelegationId.optional(),
});

export const EServiceM2MEvent = z.discriminatedUnion("visibility", [
  EServiceM2MEventPublic,
  EServiceM2MEventRestricted,
]);

export type EServiceM2MEvent = z.infer<typeof EServiceM2MEvent>;
