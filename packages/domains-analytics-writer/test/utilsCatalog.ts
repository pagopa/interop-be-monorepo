import { Batch, KafkaMessage } from "kafkajs";
import { generateId } from "pagopa-interop-models";
import { config } from "../src/config/config.js";

export const mockCatalogBatch: Batch = {
  topic: config.catalogTopic,
  partition: 0,
  highWatermark: "0",
  messages: [
    {
      value: { event_version: 1 },
    } as unknown as KafkaMessage,
    {
      value: { event_version: 2 },
    } as unknown as KafkaMessage,
  ],
  isEmpty: () => false,
  firstOffset: () => "0",
  lastOffset: () => "0",
  offsetLag: () => "0",
  offsetLagLow: () => "0",
};

export const eserviceId = generateId();
export const descriptorId = generateId();
export const interfaceId = generateId();
export const documentId = generateId();
export const riskAnalysisId = generateId();
