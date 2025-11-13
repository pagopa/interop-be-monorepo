import { z } from "zod";
import { ProducerKeychainId, ProducerKeyM2MEventId } from "../brandedIds.js";
import { AuthorizationEvent } from "../authorization/authorizationEvents.js";

export const ProducerKeyM2MEventType = z.enum([
  "ProducerKeychainKeyAdded",
  "ProducerKeychainKeyDeleted",
]);
export type ProducerKeyM2MEventType = z.infer<typeof ProducerKeyM2MEventType>;

const _: AuthorizationEvent["type"] = {} as ProducerKeyM2MEventType;
// ^ Type check: ensure ProducerKeyM2MEventType options are a subset of AuthorizationEvent["type"].
//   This is required because Zod does not have an equivalent of TS Extract<...>.

void _; // avoid unused variable TS error, cannot use ts-ignore for a type check

export const ProducerKeyM2MEvent = z.object({
  id: ProducerKeyM2MEventId,
  eventType: ProducerKeyM2MEventType,
  eventTimestamp: z.coerce.date(),
  resourceVersion: z.number().int().min(0),
  kid: z.string(), // There is no brandedId for kid
  producerKeychainId: ProducerKeychainId,
});

export type ProducerKeyM2MEvent = z.infer<typeof ProducerKeyM2MEvent>;
