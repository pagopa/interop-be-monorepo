import { match } from "ts-pattern";
import { z } from "zod";
import { EventEnvelope } from "../events/events.js";
import { protobufDecoder } from "../protobuf/protobuf.js";
import {
  PurposeTemplateAddedV2,
  PurposeTemplateArchivedV2,
  PurposeTemplateDraftDeletedV2,
  PurposeTemplateDraftUpdatedV2,
  PurposeTemplatePublishedV2,
  PurposeTemplateSuspendedV2,
  PurposeTemplateUnsuspendedV2,
} from "../gen/v2/purpose-template/events.js";

export const PurposeTemplateEventV2 = z.discriminatedUnion("type", [
  z.object({
    event_version: z.literal(2),
    type: z.literal("PurposeTemplatePublished"),
    data: protobufDecoder(PurposeTemplatePublishedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("PurposeTemplateAdded"),
    data: protobufDecoder(PurposeTemplateAddedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("PurposeTemplateUnsuspended"),
    data: protobufDecoder(PurposeTemplateUnsuspendedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("PurposeTemplateSuspended"),
    data: protobufDecoder(PurposeTemplateSuspendedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("PurposeTemplateArchived"),
    data: protobufDecoder(PurposeTemplateArchivedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("PurposeTemplateDraftUpdated"),
    data: protobufDecoder(PurposeTemplateDraftUpdatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("PurposeTemplateDraftDeleted"),
    data: protobufDecoder(PurposeTemplateDraftDeletedV2),
  }),
]);
export type PurposeTemplateEventV2 = z.infer<typeof PurposeTemplateEventV2>;

export function purposeTemplateEventToBinaryDataV2(
  event: PurposeTemplateEventV2
): Uint8Array {
  return match(event)
    .with({ type: "PurposeTemplatePublished" }, ({ data }) =>
      PurposeTemplatePublishedV2.toBinary(data)
    )
    .with({ type: "PurposeTemplateAdded" }, ({ data }) =>
      PurposeTemplateAddedV2.toBinary(data)
    )
    .with({ type: "PurposeTemplateUnsuspended" }, ({ data }) =>
      PurposeTemplateUnsuspendedV2.toBinary(data)
    )
    .with({ type: "PurposeTemplateSuspended" }, ({ data }) =>
      PurposeTemplateSuspendedV2.toBinary(data)
    )
    .with({ type: "PurposeTemplateArchived" }, ({ data }) =>
      PurposeTemplateArchivedV2.toBinary(data)
    )
    .with({ type: "PurposeTemplateDraftUpdated" }, ({ data }) =>
      PurposeTemplateDraftUpdatedV2.toBinary(data)
    )
    .with({ type: "PurposeTemplateDraftDeleted" }, ({ data }) =>
      PurposeTemplateDraftDeletedV2.toBinary(data)
    )
    .exhaustive();
}

const eventV2 = z
  .object({
    event_version: z.literal(2),
  })
  .passthrough();

export const PurposeTemplateEvent = z
  .discriminatedUnion("event_version", [eventV2])
  .transform((obj, ctx) => {
    const res = match(obj)
      .with({ event_version: 2 }, () => PurposeTemplateEventV2.safeParse(obj))
      .exhaustive();

    if (!res.success) {
      res.error.issues.forEach(ctx.addIssue);
      return z.NEVER;
    }
    return res.data;
  });
export type PurposeTemplateEvent = z.infer<typeof PurposeTemplateEvent>;

export const PurposeTemplateEventEnvelopeV2 = EventEnvelope(
  PurposeTemplateEventV2
);
export type PurposeTemplateEventEnvelopeV2 = z.infer<
  typeof PurposeTemplateEventEnvelopeV2
>;

export const PurposeTemplateEventEnvelope = EventEnvelope(PurposeTemplateEvent);
export type PurposeTemplateEventEnvelope = z.infer<
  typeof PurposeTemplateEventEnvelope
>;
