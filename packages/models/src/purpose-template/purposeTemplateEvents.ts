import { match } from "ts-pattern";
import { z } from "zod";
import { EventEnvelope } from "../events/events.js";
import { protobufDecoder } from "../protobuf/protobuf.js";
import {
  PurposeTemplateAddedV2,
  PurposeTemplateAnnotationDocumentDeletedV2,
  PurposeTemplateArchivedV2,
  PurposeTemplateDraftDeletedV2,
  PurposeTemplateDraftUpdatedV2,
  PurposeTemplateEServiceLinkedV2,
  PurposeTemplateEServiceUnlinkedV2,
  PurposeTemplatePublishedV2,
  PurposeTemplateSuspendedV2,
  PurposeTemplateUnsuspendedV2,
  PurposeTemplateAnnotationDocumentAddedV2,
  PurposeTemplateAnnotationDocumentUpdatedV2,
  RiskAnalysisTemplateDocumentGeneratedV2,
  RiskAnalysisTemplateSignedDocumentGeneratedV2,
} from "../gen/v2/purpose-template/events.js";

export const PurposeTemplateEventV2 = z.discriminatedUnion("type", [
  z.object({
    event_version: z.literal(2),
    type: z.literal("PurposeTemplateAdded"),
    data: protobufDecoder(PurposeTemplateAddedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("PurposeTemplateEServiceLinked"),
    data: protobufDecoder(PurposeTemplateEServiceLinkedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("PurposeTemplateEServiceUnlinked"),
    data: protobufDecoder(PurposeTemplateEServiceUnlinkedV2),
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
  z.object({
    event_version: z.literal(2),
    type: z.literal("PurposeTemplatePublished"),
    data: protobufDecoder(PurposeTemplatePublishedV2),
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
    type: z.literal("PurposeTemplateAnnotationDocumentAdded"),
    data: protobufDecoder(PurposeTemplateAnnotationDocumentAddedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("PurposeTemplateAnnotationDocumentDeleted"),
    data: protobufDecoder(PurposeTemplateAnnotationDocumentDeletedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("PurposeTemplateAnnotationDocumentUpdated"),
    data: protobufDecoder(PurposeTemplateAnnotationDocumentUpdatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("RiskAnalysisTemplateDocumentGenerated"),
    data: protobufDecoder(RiskAnalysisTemplateDocumentGeneratedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("RiskAnalysisTemplateSignedDocumentGenerated"),
    data: protobufDecoder(RiskAnalysisTemplateSignedDocumentGeneratedV2),
  }),
]);
export type PurposeTemplateEventV2 = z.infer<typeof PurposeTemplateEventV2>;

export function purposeTemplateEventToBinaryDataV2(
  event: PurposeTemplateEventV2
): Uint8Array {
  return match(event)
    .with({ type: "PurposeTemplateAdded" }, (e) =>
      PurposeTemplateAddedV2.toBinary(e.data)
    )
    .with({ type: "PurposeTemplateEServiceLinked" }, (e) =>
      PurposeTemplateEServiceLinkedV2.toBinary(e.data)
    )
    .with({ type: "PurposeTemplateEServiceUnlinked" }, (e) =>
      PurposeTemplateEServiceUnlinkedV2.toBinary(e.data)
    )
    .with({ type: "PurposeTemplateDraftUpdated" }, (e) =>
      PurposeTemplateDraftUpdatedV2.toBinary(e.data)
    )
    .with({ type: "PurposeTemplateDraftDeleted" }, (e) =>
      PurposeTemplateDraftDeletedV2.toBinary(e.data)
    )
    .with({ type: "PurposeTemplatePublished" }, (e) =>
      PurposeTemplatePublishedV2.toBinary(e.data)
    )
    .with({ type: "PurposeTemplateUnsuspended" }, (e) =>
      PurposeTemplateUnsuspendedV2.toBinary(e.data)
    )
    .with({ type: "PurposeTemplateSuspended" }, (e) =>
      PurposeTemplateSuspendedV2.toBinary(e.data)
    )
    .with({ type: "PurposeTemplateArchived" }, (e) =>
      PurposeTemplateArchivedV2.toBinary(e.data)
    )
    .with(
      {
        type: "PurposeTemplateAnnotationDocumentAdded",
      },
      (e) => PurposeTemplateAnnotationDocumentAddedV2.toBinary(e.data)
    )
    .with({ type: "PurposeTemplateAnnotationDocumentDeleted" }, (e) =>
      PurposeTemplateAnnotationDocumentDeletedV2.toBinary(e.data)
    )
    .with({ type: "PurposeTemplateAnnotationDocumentUpdated" }, (e) =>
      PurposeTemplateAnnotationDocumentUpdatedV2.toBinary(e.data)
    )
    .with({ type: "RiskAnalysisTemplateDocumentGenerated" }, (e) =>
      RiskAnalysisTemplateDocumentGeneratedV2.toBinary(e.data)
    )
    .with({ type: "RiskAnalysisTemplateSignedDocumentGenerated" }, (e) =>
      RiskAnalysisTemplateSignedDocumentGeneratedV2.toBinary(e.data)
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
