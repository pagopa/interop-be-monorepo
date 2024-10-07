import { z } from "zod";
import { match } from "ts-pattern";

import {
  DelegationSubmittedV2,
  DelegationApprovedV2,
  DelegationRejectedV2,
  DelegationRevokedV2,
} from "../gen/v2/delegation/events.js";
import { protobufDecoder } from "../protobuf/protobuf.js";
import { EventEnvelope } from "../events/events.js";

export const DelegationEventV2 = z.discriminatedUnion("type", [
  z.object({
    event_version: z.literal(2),
    type: z.literal("DelegationSubmittedV2"),
    data: protobufDecoder(DelegationSubmittedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("DelegationApprovedV2"),
    data: protobufDecoder(DelegationApprovedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("DelegationRejectedV2"),
    data: protobufDecoder(DelegationRejectedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("DelegationRevokedV2"),
    data: protobufDecoder(DelegationRevokedV2),
  }),
]);

export type DelegationEventV2 = z.infer<typeof DelegationEventV2>;

export function delegationEventToBinaryDataV2(
  event: DelegationEventV2
): Uint8Array {
  return match(event)
    .with({ type: "DelegationSubmittedV2" }, ({ data }) =>
      DelegationSubmittedV2.toBinary(data)
    )
    .with({ type: "DelegationApprovedV2" }, ({ data }) =>
      DelegationApprovedV2.toBinary(data)
    )
    .with({ type: "DelegationRejectedV2" }, ({ data }) =>
      DelegationRejectedV2.toBinary(data)
    )
    .with({ type: "DelegationRevokedV2" }, ({ data }) =>
      DelegationRevokedV2.toBinary(data)
    )
    .exhaustive();
}

const eventV2 = z
  .object({
    event_version: z.literal(2),
  })
  .passthrough();

export const DelegationEvent = z
  .discriminatedUnion("event_version", [eventV2])
  .transform((obj, ctx) => {
    const res = match(obj)
      .with({ event_version: 2 }, () => DelegationEventV2.safeParse(obj))
      .exhaustive();

    if (!res.success) {
      res.error.issues.forEach(ctx.addIssue);
      return z.NEVER;
    }
    return res.data;
  });

export type DelegationEvent = z.infer<typeof DelegationEvent>;

export const DelegationEventEnvelopeV2 = EventEnvelope(DelegationEventV2);
export type DelegationEventEnvelopeV2 = z.infer<
  typeof DelegationEventEnvelopeV2
>;

export const DelegationEventEnvelope = EventEnvelope(DelegationEvent);
export type DelegationEventEnvelope = z.infer<typeof DelegationEventEnvelope>;
