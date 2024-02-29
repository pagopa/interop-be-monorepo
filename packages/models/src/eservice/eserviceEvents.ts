import { match } from "ts-pattern";
import { z } from "zod";
import {
  ClonedEServiceAddedV1,
  EServiceAddedV1,
  EServiceDeletedV1,
  EServiceDescriptorAddedV1,
  EServiceDescriptorUpdatedV1,
  EServiceDocumentAddedV1,
  EServiceDocumentDeletedV1,
  EServiceDocumentUpdatedV1,
  EServiceUpdatedV1,
  EServiceWithDescriptorsDeletedV1,
  MovedAttributesFromEserviceToDescriptorsV1,
} from "../gen/v1/eservice/events.js";
import { EventEnvelope, protobufDecoder } from "../index.js";
import {
  DraftEServiceUpdatedV2,
  EServiceAddedV2,
  EServiceClonedV2,
  EServiceDeletedV2,
  EServiceDescriptorActivatedV2,
  EServiceDescriptorAddedV2,
  EServiceDescriptorArchivedV2,
  EServiceDescriptorDeletedV2,
  EServiceDescriptorDocumentAddedV2,
  EServiceDescriptorDocumentDeletedV2,
  EServiceDescriptorDocumentUpdatedV2,
  EServiceDescriptorInterfaceAddedV2,
  EServiceDescriptorInterfaceDeletedV2,
  EServiceDescriptorInterfaceUpdatedV2,
  EServiceDescriptorPublishedV2,
  EServiceDescriptorSuspendedV2,
  EServiceDraftDescriptorUpdatedV2,
} from "../gen/v2/eservice/events.js";

export function catalogEventToBinaryData(event: EServiceEvent): Uint8Array {
  return match(event)
    .with({ event_version: 1 }, catalogEventToBinaryDataV1)
    .with({ event_version: 2 }, catalogEventToBinaryDataV2)
    .exhaustive();
}

export function catalogEventToBinaryDataV1(event: EServiceEventV1): Uint8Array {
  return match(event)
    .with({ type: "EServiceAdded" }, ({ data }) =>
      EServiceAddedV1.toBinary(data)
    )
    .with({ type: "ClonedEServiceAdded" }, ({ data }) =>
      ClonedEServiceAddedV1.toBinary(data)
    )
    .with({ type: "EServiceUpdated" }, ({ data }) =>
      EServiceUpdatedV1.toBinary(data)
    )
    .with({ type: "EServiceWithDescriptorsDeleted" }, ({ data }) =>
      EServiceWithDescriptorsDeletedV1.toBinary(data)
    )
    .with({ type: "EServiceDocumentUpdated" }, ({ data }) =>
      EServiceDocumentUpdatedV1.toBinary(data)
    )
    .with({ type: "EServiceDeleted" }, ({ data }) =>
      EServiceDeletedV1.toBinary(data)
    )
    .with({ type: "EServiceDocumentAdded" }, ({ data }) =>
      EServiceDocumentAddedV1.toBinary(data)
    )
    .with({ type: "EServiceDocumentDeleted" }, ({ data }) =>
      EServiceDocumentDeletedV1.toBinary(data)
    )
    .with({ type: "EServiceDescriptorAdded" }, ({ data }) =>
      EServiceDescriptorAddedV1.toBinary(data)
    )
    .with({ type: "EServiceDescriptorUpdated" }, ({ data }) =>
      EServiceDescriptorUpdatedV1.toBinary(data)
    )
    .with({ type: "MovedAttributesFromEserviceToDescriptors" }, ({ data }) =>
      MovedAttributesFromEserviceToDescriptorsV1.toBinary(data)
    )
    .exhaustive();
}

export function catalogEventToBinaryDataV2(event: EServiceEventV2): Uint8Array {
  return match(event)
    .with({ type: "EServiceAdded" }, ({ data }) =>
      EServiceAddedV2.toBinary(data)
    )
    .with({ type: "DraftEServiceUpdated" }, ({ data }) =>
      DraftEServiceUpdatedV2.toBinary(data)
    )
    .with({ type: "EServiceDeleted" }, ({ data }) =>
      EServiceDeletedV2.toBinary(data)
    )
    .with({ type: "EServiceCloned" }, ({ data }) =>
      EServiceClonedV2.toBinary(data)
    )
    .with({ type: "EServiceDescriptorAdded" }, ({ data }) =>
      EServiceDescriptorAddedV2.toBinary(data)
    )
    .with({ type: "EServiceDraftDescriptorUpdated" }, ({ data }) =>
      EServiceDraftDescriptorUpdatedV2.toBinary(data)
    )
    .with({ type: "EServiceDescriptorActivated" }, ({ data }) =>
      EServiceDescriptorActivatedV2.toBinary(data)
    )
    .with({ type: "EServiceDescriptorArchived" }, ({ data }) =>
      EServiceDescriptorArchivedV2.toBinary(data)
    )
    .with({ type: "EServiceDescriptorPublished" }, ({ data }) =>
      EServiceDescriptorPublishedV2.toBinary(data)
    )
    .with({ type: "EServiceDescriptorSuspended" }, ({ data }) =>
      EServiceDescriptorSuspendedV2.toBinary(data)
    )
    .with({ type: "EServiceDescriptorDeleted" }, ({ data }) =>
      EServiceDescriptorDeletedV2.toBinary(data)
    )
    .with({ type: "EServiceDescriptorInterfaceAdded" }, ({ data }) =>
      EServiceDescriptorInterfaceAddedV2.toBinary(data)
    )
    .with({ type: "EServiceDescriptorDocumentAdded" }, ({ data }) =>
      EServiceDescriptorDocumentAddedV2.toBinary(data)
    )
    .with({ type: "EServiceDescriptorInterfaceUpdated" }, ({ data }) =>
      EServiceDescriptorInterfaceUpdatedV2.toBinary(data)
    )
    .with({ type: "EServiceDescriptorDocumentUpdated" }, ({ data }) =>
      EServiceDescriptorDocumentUpdatedV2.toBinary(data)
    )
    .with({ type: "EServiceDescriptorInterfaceDeleted" }, ({ data }) =>
      EServiceDescriptorInterfaceDeletedV2.toBinary(data)
    )
    .with({ type: "EServiceDescriptorDocumentDeleted" }, ({ data }) =>
      EServiceDescriptorDocumentDeletedV2.toBinary(data)
    )
    .exhaustive();
}

export const EServiceEventV1 = z.discriminatedUnion("type", [
  z.object({
    event_version: z.literal(1),
    type: z.literal("EServiceAdded"),
    data: protobufDecoder(EServiceAddedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("ClonedEServiceAdded"),
    data: protobufDecoder(ClonedEServiceAddedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("EServiceUpdated"),
    data: protobufDecoder(EServiceUpdatedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("EServiceWithDescriptorsDeleted"),
    data: protobufDecoder(EServiceWithDescriptorsDeletedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("EServiceDocumentUpdated"),
    data: protobufDecoder(EServiceDocumentUpdatedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("EServiceDeleted"),
    data: protobufDecoder(EServiceDeletedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("EServiceDocumentAdded"),
    data: protobufDecoder(EServiceDocumentAddedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("EServiceDocumentDeleted"),
    data: protobufDecoder(EServiceDocumentDeletedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("EServiceDescriptorAdded"),
    data: protobufDecoder(EServiceDescriptorAddedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("EServiceDescriptorUpdated"),
    data: protobufDecoder(EServiceDescriptorUpdatedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("MovedAttributesFromEserviceToDescriptors"),
    data: protobufDecoder(MovedAttributesFromEserviceToDescriptorsV1),
  }),
]);
export type EServiceEventV1 = z.infer<typeof EServiceEventV1>;

export const EServiceEventV2 = z.discriminatedUnion("type", [
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceAdded"),
    data: protobufDecoder(EServiceAddedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("DraftEServiceUpdated"),
    data: protobufDecoder(DraftEServiceUpdatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDeleted"),
    data: protobufDecoder(EServiceDeletedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceCloned"),
    data: protobufDecoder(EServiceClonedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDescriptorAdded"),
    data: protobufDecoder(EServiceDescriptorAddedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDraftDescriptorUpdated"),
    data: protobufDecoder(EServiceDraftDescriptorUpdatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDescriptorActivated"),
    data: protobufDecoder(EServiceDescriptorActivatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDescriptorArchived"),
    data: protobufDecoder(EServiceDescriptorArchivedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDescriptorPublished"),
    data: protobufDecoder(EServiceDescriptorPublishedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDescriptorSuspended"),
    data: protobufDecoder(EServiceDescriptorSuspendedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDescriptorDeleted"),
    data: protobufDecoder(EServiceDescriptorDeletedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDescriptorInterfaceAdded"),
    data: protobufDecoder(EServiceDescriptorInterfaceAddedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDescriptorDocumentAdded"),
    data: protobufDecoder(EServiceDescriptorDocumentAddedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDescriptorInterfaceUpdated"),
    data: protobufDecoder(EServiceDescriptorInterfaceUpdatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDescriptorDocumentUpdated"),
    data: protobufDecoder(EServiceDescriptorDocumentUpdatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDescriptorInterfaceDeleted"),
    data: protobufDecoder(EServiceDescriptorInterfaceDeletedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDescriptorDocumentDeleted"),
    data: protobufDecoder(EServiceDescriptorDocumentDeletedV2),
  }),
]);
export type EServiceEventV2 = z.infer<typeof EServiceEventV2>;

const eventV1 = z
  .object({
    event_version: z.literal(1),
  })
  .passthrough();
const eventV2 = z
  .object({
    event_version: z.literal(2),
  })
  .passthrough();

export const EServiceEvent = z
  .discriminatedUnion("event_version", [eventV1, eventV2])
  .transform((obj, ctx) => {
    const res = match(obj)
      .with({ event_version: 1 }, () => EServiceEventV1.safeParse(obj))
      .with({ event_version: 2 }, () => EServiceEventV2.safeParse(obj))
      .exhaustive();

    if (!res.success) {
      res.error.issues.forEach(ctx.addIssue);
      return z.NEVER;
    }
    return res.data;
  });

export type EServiceEvent = z.infer<typeof EServiceEvent>;

export const EServiceEventEnvelopeV1 = EventEnvelope(EServiceEventV1);
export type EServiceEventEnvelopeV1 = z.infer<typeof EServiceEventEnvelopeV1>;

export const EServiceEventEnvelopeV2 = EventEnvelope(EServiceEventV2);
export type EServiceEventEnvelopeV2 = z.infer<typeof EServiceEventEnvelopeV2>;

export const EServiceEventEnvelope = EventEnvelope(EServiceEvent);
export type EServiceEventEnvelope = z.infer<typeof EServiceEventEnvelope>;
