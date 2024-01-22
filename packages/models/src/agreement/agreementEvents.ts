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
import { EventEnvelope } from "../index.js";

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

const AgreementEventAdded = z.object({
  type: z.literal("AgreementAdded"),
  data: protobufDecoder(AgreementAddedV1),
});
export type AgreementEventAdded = z.infer<typeof AgreementEventAdded>;

export const AgreementEventDeleted = z.object({
  type: z.literal("AgreementDeleted"),
  data: protobufDecoder(AgreementDeletedV1),
});
export type AgreementEventDeleted = z.infer<typeof AgreementEventDeleted>;

export const AgreementEventUpdated = z.object({
  type: z.literal("AgreementUpdated"),
  data: protobufDecoder(AgreementUpdatedV1),
});
export type AgreementEventUpdated = z.infer<typeof AgreementEventUpdated>;

export const AgreementEventConsumerDocumentAdded = z.object({
  type: z.literal("AgreementConsumerDocumentAdded"),
  data: protobufDecoder(AgreementConsumerDocumentAddedV1),
});
export type AgreementEventConsumerDocumentAdded = z.infer<
  typeof AgreementEventConsumerDocumentAdded
>;

export const AgreementEventConsumerDocumentRemoved = z.object({
  type: z.literal("AgreementConsumerDocumentRemoved"),
  data: protobufDecoder(AgreementConsumerDocumentRemovedV1),
});
export type AgreementEventConsumerDocumentRemoved = z.infer<
  typeof AgreementEventConsumerDocumentRemoved
>;

export const AgreementEventContractAdded = z.object({
  type: z.literal("AgreementContractAdded"),
  data: protobufDecoder(AgreementContractAddedV1),
});
export type AgreementEventContractAdded = z.infer<
  typeof AgreementEventContractAdded
>;

export const AgreementEvent = z.discriminatedUnion("type", [
  AgreementEventAdded,
  AgreementEventDeleted,
  AgreementEventUpdated,
  AgreementEventConsumerDocumentAdded,
  AgreementEventConsumerDocumentRemoved,
  AgreementEventContractAdded,
]);
export type AgreementEvent = z.infer<typeof AgreementEvent>;

export const AgreementEventEnvelope = EventEnvelope(AgreementEvent);
export type AgreementEventEnvelope = z.infer<typeof AgreementEventEnvelope>;
