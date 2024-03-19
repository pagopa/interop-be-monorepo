import { match } from "ts-pattern";
import { z } from "zod";
import {
  AgreementAddedV1,
  AgreementDeletedV1,
  AgreementUpdatedV1,
  AgreementContractAddedV1,
  AgreementConsumerDocumentAddedV1,
  AgreementConsumerDocumentRemovedV1,
} from "../gen/v1/agreement/events.js";
import { protobufDecoder } from "../protobuf/protobuf.js";
import { EventEnvelope } from "../events/events.js";

export function agreementEventToBinaryData(event: AgreementEvent): Uint8Array {
  return match(event)
    .with({ type: "AgreementDeleted" }, ({ data }) =>
      AgreementDeletedV1.toBinary(data)
    )
    .with({ type: "AgreementAdded" }, ({ data }) =>
      AgreementAddedV1.toBinary(data)
    )
    .with({ type: "AgreementUpdated" }, ({ data }) =>
      AgreementUpdatedV1.toBinary(data)
    )
    .with({ type: "AgreementContractAdded" }, ({ data }) =>
      AgreementContractAddedV1.toBinary(data)
    )
    .with({ type: "AgreementConsumerDocumentAdded" }, ({ data }) =>
      AgreementConsumerDocumentAddedV1.toBinary(data)
    )
    .with({ type: "AgreementConsumerDocumentRemoved" }, ({ data }) =>
      AgreementConsumerDocumentRemovedV1.toBinary(data)
    )
    .exhaustive();
}

export const AgreementAddEvent = z.object({
  event_version: z.literal(1),
  type: z.literal("AgreementAdded"),
  data: protobufDecoder(AgreementAddedV1),
});
export type AgreementAddEvent = z.infer<typeof AgreementAddEvent>;

export const AgreementDeleteEvent = z.object({
  event_version: z.literal(1),
  type: z.literal("AgreementDeleted"),
  data: protobufDecoder(AgreementDeletedV1),
});
export type AgreementDeleteEvent = z.infer<typeof AgreementDeleteEvent>;

export const AgreementUpdateEvent = z.object({
  event_version: z.literal(1),
  type: z.literal("AgreementUpdated"),
  data: protobufDecoder(AgreementUpdatedV1),
});
export type AgreementUpdateEvent = z.infer<typeof AgreementUpdateEvent>;

export const AgreementAddConsumerDocumentEvent = z.object({
  event_version: z.literal(1),
  type: z.literal("AgreementConsumerDocumentAdded"),
  data: protobufDecoder(AgreementConsumerDocumentAddedV1),
});
export type AgreementAddConsumerDocumentEvent = z.infer<
  typeof AgreementAddConsumerDocumentEvent
>;

export const AgreementRemoveConsumerDocumentEvent = z.object({
  event_version: z.literal(1),
  type: z.literal("AgreementConsumerDocumentRemoved"),
  data: protobufDecoder(AgreementConsumerDocumentRemovedV1),
});
export type AgreementRemoveConsumerDocumentEvent = z.infer<
  typeof AgreementRemoveConsumerDocumentEvent
>;

export const AgreementAddContractEvent = z.object({
  event_version: z.literal(1),
  type: z.literal("AgreementContractAdded"),
  data: protobufDecoder(AgreementContractAddedV1),
});
export type AgreementAddContractEvent = z.infer<
  typeof AgreementAddContractEvent
>;

export const AgreementEvent = z.discriminatedUnion("type", [
  AgreementAddEvent,
  AgreementDeleteEvent,
  AgreementUpdateEvent,
  AgreementAddConsumerDocumentEvent,
  AgreementRemoveConsumerDocumentEvent,
  AgreementAddContractEvent,
]);
export type AgreementEvent = z.infer<typeof AgreementEvent>;

export const AgreementEventEnvelope = EventEnvelope(AgreementEvent);
export type AgreementEventEnvelope = z.infer<typeof AgreementEventEnvelope>;
