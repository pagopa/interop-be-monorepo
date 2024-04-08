import { match } from "ts-pattern";
import { z } from "zod";
import { EventEnvelope } from "../events/events.js";
import {
  PurposeCreatedV1,
  PurposeDeletedV1,
  PurposeUpdatedV1,
  PurposeVersionActivatedV1,
  PurposeVersionArchivedV1,
  PurposeVersionCreatedV1,
  PurposeVersionDeletedV1,
  PurposeVersionRejectedV1,
  PurposeVersionSuspendedV1,
  PurposeVersionUpdatedV1,
  PurposeVersionWaitedForApprovalV1,
} from "../gen/v1/purpose/events.js";
import { protobufDecoder } from "../protobuf/protobuf.js";

export function purposeEventToBinaryData(event: PurposeEvent): Uint8Array {
  return match(event)
    .with({ event_version: 1 }, purposeEventToBinaryDataV1)
    .exhaustive();
}

export function purposeEventToBinaryDataV1(event: PurposeEvent): Uint8Array {
  return match(event)
    .with({ type: "PurposeCreated" }, ({ data }) =>
      PurposeCreatedV1.toBinary(data)
    )
    .with({ type: "PurposeVersionCreated" }, ({ data }) =>
      PurposeVersionCreatedV1.toBinary(data)
    )
    .with({ type: "PurposeUpdated" }, ({ data }) =>
      PurposeUpdatedV1.toBinary(data)
    )
    .with({ type: "PurposeVersionUpdated" }, ({ data }) =>
      PurposeVersionUpdatedV1.toBinary(data)
    )
    .with({ type: "PurposeVersionActivated" }, ({ data }) =>
      PurposeVersionActivatedV1.toBinary(data)
    )
    .with({ type: "PurposeVersionRejected" }, ({ data }) =>
      PurposeVersionRejectedV1.toBinary(data)
    )
    .with({ type: "PurposeVersionSuspended" }, ({ data }) =>
      PurposeVersionSuspendedV1.toBinary(data)
    )
    .with({ type: "PurposeVersionArchived" }, ({ data }) =>
      PurposeVersionArchivedV1.toBinary(data)
    )
    .with({ type: "PurposeVersionWaitedForApproval" }, ({ data }) =>
      PurposeVersionWaitedForApprovalV1.toBinary(data)
    )
    .with({ type: "PurposeDeleted" }, ({ data }) =>
      PurposeDeletedV1.toBinary(data)
    )
    .with({ type: "PurposeVersionDeleted" }, ({ data }) =>
      PurposeVersionDeletedV1.toBinary(data)
    )
    .exhaustive();
}

export const PurposeEventV1 = z.discriminatedUnion("type", [
  z.object({
    event_version: z.literal(1),
    type: z.literal("PurposeCreated"),
    data: protobufDecoder(PurposeCreatedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("PurposeUpdated"),
    data: protobufDecoder(PurposeUpdatedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("PurposeVersionWaitedForApproval"),
    data: protobufDecoder(PurposeVersionWaitedForApprovalV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("PurposeVersionActivated"),
    data: protobufDecoder(PurposeVersionActivatedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("PurposeVersionCreated"),
    data: protobufDecoder(PurposeVersionCreatedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("PurposeVersionSuspended"),
    data: protobufDecoder(PurposeVersionSuspendedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("PurposeVersionArchived"),
    data: protobufDecoder(PurposeVersionArchivedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("PurposeVersionUpdated"),
    data: protobufDecoder(PurposeVersionUpdatedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("PurposeVersionDeleted"),
    data: protobufDecoder(PurposeVersionDeletedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("PurposeDeleted"),
    data: protobufDecoder(PurposeDeletedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("PurposeVersionRejected"),
    data: protobufDecoder(PurposeVersionRejectedV1),
  }),
]);
export type PurposeEventV1 = z.infer<typeof PurposeEventV1>;

const eventV1 = z
  .object({
    event_version: z.literal(1),
  })
  .passthrough();

export const PurposeEvent = z
  .discriminatedUnion("event_version", [eventV1])
  .transform((obj, ctx) => {
    const res = match(obj)
      .with({ event_version: 1 }, () => PurposeEventV1.safeParse(obj))
      .exhaustive();

    if (!res.success) {
      res.error.issues.forEach(ctx.addIssue);
      return z.NEVER;
    }
    return res.data;
  });
export type PurposeEvent = z.infer<typeof PurposeEvent>;

export const PurposeEventEnvelopeV1 = EventEnvelope(PurposeEventV1);
export type PurposeEventEnvelopeV1 = z.infer<typeof PurposeEventEnvelopeV1>;

export const PurposeEventEnvelope = EventEnvelope(PurposeEvent);
export type PurposeEventEnvelope = z.infer<typeof PurposeEventEnvelope>;
