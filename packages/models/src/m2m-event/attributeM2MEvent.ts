import { z } from "zod";
import { AttributeId, AttributeM2MEventId } from "../brandedIds.js";
import { AttributeEvent } from "../attribute/attributeEvents.js";

const AttributeM2MEventType = z.literal("AttributeAdded");
// ^ Convert into a z.union([...]) if supporting more event types
export type AttributeM2MEventType = z.infer<typeof AttributeM2MEventType>;

const _: AttributeEvent["type"] = {} as AttributeM2MEventType;
// ^ Type check: ensure AttributeM2MEventType options are a subset of AttributeEvent["type"].
//   This is required because Zod does not have an equivalent of TS Extract<...>.

void _; // avoid unused variable TS error, cannot use ts-ignore for a type check

export const AttributeM2MEvent = z.object({
  id: AttributeM2MEventId,
  eventType: AttributeM2MEventType,
  eventTimestamp: z.coerce.date(),
  attributeId: AttributeId,
});

export type AttributeM2MEvent = z.infer<typeof AttributeM2MEvent>;
