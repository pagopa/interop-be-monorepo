import { z } from "zod";
import {
  ProducerKeychainId,
  ProducerKeychainM2MEventId,
  TenantId,
} from "../brandedIds.js";
import { AuthorizationEvent } from "../authorization/authorizationEvents.js";
import {
  m2mEventVisibility,
  M2MEventVisibility,
} from "./m2mEventVisibility.js";

export const ProducerKeychainM2MEventType = z.enum([
  "ProducerKeychainAdded",
  "ProducerKeychainDeleted",
  "ProducerKeychainEServiceAdded",
  "ProducerKeychainEServiceRemoved",
]);
export type ProducerKeychainM2MEventType = z.infer<
  typeof ProducerKeychainM2MEventType
>;

const _: AuthorizationEvent["type"] = {} as ProducerKeychainM2MEventType;
// ^ Type check: ensure ProducerKeychainM2MEventType options are a subset of AuthorizationEvent["type"].
//   This is required because Zod does not have an equivalent of TS Extract<...>.

void _; // avoid unused variable TS error, cannot use ts-ignore for a type check

export const ProducerKeychainM2MEvent = z.object({
  id: ProducerKeychainM2MEventId,
  eventType: ProducerKeychainM2MEventType,
  eventTimestamp: z.coerce.date(),
  resourceVersion: z.number().int().min(0),
  producerKeychainId: ProducerKeychainId,
  producerId: TenantId,
  visibility: M2MEventVisibility.extract([
    m2mEventVisibility.owner,
    m2mEventVisibility.public,
    // No ProducerKeychain M2M events with Restricted visibility
  ]),
});

export type ProducerKeychainM2MEvent = z.infer<typeof ProducerKeychainM2MEvent>;
