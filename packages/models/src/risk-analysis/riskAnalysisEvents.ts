import { z } from "zod";
import { match } from "ts-pattern";
import {
  RiskAnalysisCreatedV2,
  RiskAnalysisUpdatedV2,
  RiskAnalysisDeletedV2,
} from "../gen/v2/risk-analysis/events.js";
import { protobufDecoder } from "../protobuf/protobuf.js";
import { EventEnvelope } from "../events/events.js";

export const RiskAnalysisEventV2 = z.discriminatedUnion("type", [
  z.object({
    event_version: z.literal(2),
    type: z.literal("RiskAnalysisCreated"),
    data: protobufDecoder(RiskAnalysisCreatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("RiskAnalysisUpdated"),
    data: protobufDecoder(RiskAnalysisUpdatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("RiskAnalysisDeleted"),
    data: protobufDecoder(RiskAnalysisDeletedV2),
  }),
]);
export type RiskAnalysisEventV2 = z.infer<typeof RiskAnalysisEventV2>;

export const RiskAnalysisEvent = RiskAnalysisEventV2;
export type RiskAnalysisEvent = z.infer<typeof RiskAnalysisEvent>;

export const RiskAnalysisEventEnvelope = EventEnvelope(RiskAnalysisEvent);
export type RiskAnalysisEventEnvelope = z.infer<typeof RiskAnalysisEventEnvelope>;

export function riskAnalysisEventToBinaryData(event: RiskAnalysisEvent): Uint8Array {
  return match(event)
    .with({ type: "RiskAnalysisCreated" }, ({ data }) =>
      RiskAnalysisCreatedV2.toBinary(data)
    )
    .with({ type: "RiskAnalysisUpdated" }, ({ data }) =>
      RiskAnalysisUpdatedV2.toBinary(data)
    )
    .with({ type: "RiskAnalysisDeleted" }, ({ data }) =>
      RiskAnalysisDeletedV2.toBinary(data)
    )
    .exhaustive();
}
