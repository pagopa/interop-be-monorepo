import { z } from "zod";
import { KeyM2MEventId } from "../brandedIds.js";
import { AuthorizationEvent } from "../authorization/authorizationEvents.js";

export const KeyM2MEventType = z.enum(["ClientKeyAdded", "ClientKeyDeleted"]);
export type KeyM2MEventType = z.infer<typeof KeyM2MEventType>;

const _: AuthorizationEvent["type"] = {} as KeyM2MEventType;
// ^ Type check: ensure KeyM2MEventType options are a subset of AuthorizationEvent["type"].
//   This is required because Zod does not have an equivalent of TS Extract<...>.

void _; // avoid unused variable TS error, cannot use ts-ignore for a type check

export const KeyM2MEvent = z.object({
  id: KeyM2MEventId,
  eventType: KeyM2MEventType,
  eventTimestamp: z.coerce.date(),
  resourceVersion: z.number().int().min(0),
  kid: z.string(), // There is no brandedId for KeyId
});

export type KeyM2MEvent = z.infer<typeof KeyM2MEvent>;
