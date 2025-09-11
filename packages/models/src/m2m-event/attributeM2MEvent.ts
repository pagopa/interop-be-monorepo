import { z } from "zod";
import { AttributeId, AttributeM2MEventId } from "../brandedIds.js";
import { AttributeEvent } from "../attribute/attributeEvents.js";

const AttributeM2MEventType = z.union([
  z.literal("AttributeAdded"),
  z.literal("MaintenanceAttributeDeleted"),
]);
export type AttributeM2MEventType = z.infer<typeof AttributeM2MEventType> &
  AttributeEvent["type"];
// ^ make sure it's compatible with AttributeEvent types

export const AttributeM2MEvent = z.object({
  id: AttributeM2MEventId,
  eventType: AttributeM2MEventType,
  eventTimestamp: z.coerce.date(),
  attributeId: AttributeId,
});

export type AttributeM2MEvent = z.infer<typeof AttributeM2MEvent>;
