import { z } from "zod";
import { DelegationId, DelegationM2MEventId } from "../brandedIds.js";
import { DelegationEvent } from "../delegation/delegationEvents.js";

export const DelegationM2MEventType = z.enum([
  "ConsumerDelegationSubmitted",
  "ConsumerDelegationApproved",
  "ConsumerDelegationRejected",
  "ConsumerDelegationRevoked",
  "ProducerDelegationSubmitted",
  "ProducerDelegationApproved",
  "ProducerDelegationRejected",
  "ProducerDelegationRevoked",
  "DelegationSignedContractGenerated",
]);
export type DelegationM2MEventType = z.infer<typeof DelegationM2MEventType>;

const _: DelegationEvent["type"] = {} as DelegationM2MEventType;
// ^ Type check: ensure DelegationM2MEventType options are a subset of DelegationEvent["type"].
//   This is required because Zod does not have an equivalent of TS Extract<...>.

void _; // avoid unused variable TS error, cannot use ts-ignore for a type check

export const DelegationM2MEvent = z.object({
  id: DelegationM2MEventId,
  eventType: DelegationM2MEventType,
  eventTimestamp: z.coerce.date(),
  resourceVersion: z.number().int().min(0),
  delegationId: DelegationId,
});

export type DelegationM2MEvent = z.infer<typeof DelegationM2MEvent>;
