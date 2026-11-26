import { Batch, KafkaMessage } from "kafkajs";
import {
  TenantVerifier,
  generateId,
  TenantRevoker,
} from "pagopa-interop-models";

import { config } from "../src/config/config.js";

const currentDate = new Date();

export const getMockVerifiedBy = (): TenantVerifier => ({
  id: generateId(),
  verificationDate: currentDate,
});

export const getMockRevokedBy = (): TenantRevoker => ({
  id: generateId(),
  verificationDate: currentDate,
  revocationDate: currentDate,
});

export const mockTenantBatch: Batch = {
  topic: config.tenantTopic,
  partition: 0,
  highWatermark: "0",
  messages: [
    {
      value: { event_version: 1 },
    } as unknown as KafkaMessage,
    {
      value: { event_version: 2 },
    } as unknown as KafkaMessage,
    {
      value: { event_version: 3 },
    } as unknown as KafkaMessage,
  ],
  isEmpty: () => false,
  firstOffset: () => "0",
  lastOffset: () => "0",
  offsetLag: () => "0",
  offsetLagLow: () => "0",
};
