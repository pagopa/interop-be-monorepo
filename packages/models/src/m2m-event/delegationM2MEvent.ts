import { z } from "zod";
import { DelegationId, DelegationM2MEventId } from "../brandedIds.js";
import { DelegationEvent } from "../delegation/delegationEvents.js";

export const ConsumerDelegationM2MEventType = z.enum([
  "ConsumerDelegationSubmitted",
  "ConsumerDelegationApproved",
  "ConsumerDelegationRejected",
  "ConsumerDelegationRevoked",
]);

export const ProducerDelegationM2MEventType = z.enum([
  "ProducerDelegationSubmitted",
  "ProducerDelegationApproved",
  "ProducerDelegationRejected",
  "ProducerDelegationRevoked",
]);

const ContractGeneratedEventType = z.literal(
  "DelegationSignedContractGenerated"
);

export const DelegationM2MEventType = z.union([
  ConsumerDelegationM2MEventType,
  ProducerDelegationM2MEventType,
  ContractGeneratedEventType,
]);

export type DelegationM2MEventType = z.infer<typeof DelegationM2MEventType>;
export type ConsumerDelegationM2MEventType = z.infer<
  typeof ConsumerDelegationM2MEventType
>;
export type ProducerDelegationM2MEventType = z.infer<
  typeof ProducerDelegationM2MEventType
>;

const _: DelegationEvent["type"] = {} as DelegationM2MEventType;
const consumerTypeCheck: DelegationEvent["type"] =
  {} as ConsumerDelegationM2MEventType;
const producerTypeCheck: DelegationEvent["type"] =
  {} as ProducerDelegationM2MEventType;
// ^ Type check: ensure DelegationM2MEventType options are a subset of DelegationEvent["type"].
//   This is required because Zod does not have an equivalent of TS Extract<...>.

void _; // avoid unused variable TS error, cannot use ts-ignore for a type check
void consumerTypeCheck; // avoid unused variable TS error, cannot use ts-ignore for a type check
void producerTypeCheck; // avoid unused variable TS error, cannot use ts-ignore for a type check

export const DelegationM2MEvent = z.object({
  id: DelegationM2MEventId,
  eventType: DelegationM2MEventType,
  eventTimestamp: z.coerce.date(),
  resourceVersion: z.number().int().min(0),
  delegationId: DelegationId,
});

export type DelegationM2MEvent = z.infer<typeof DelegationM2MEvent>;

export const ConsumerDelegationM2MEvent = z.object({
  id: DelegationM2MEventId,
  eventType: ConsumerDelegationM2MEventType,
  eventTimestamp: z.coerce.date(),
  resourceVersion: z.number().int().min(0),
  delegationId: DelegationId,
});

export type ConsumerDelegationM2MEvent = z.infer<
  typeof ConsumerDelegationM2MEvent
>;

export const ProducerDelegationM2MEvent = z.object({
  id: DelegationM2MEventId,
  eventType: ProducerDelegationM2MEventType,
  eventTimestamp: z.coerce.date(),
  resourceVersion: z.number().int().min(0),
  delegationId: DelegationId,
});

export type ProducerDelegationM2MEvent = z.infer<
  typeof ProducerDelegationM2MEvent
>;
