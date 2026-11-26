import { Batch, KafkaMessage } from "kafkajs";
import {
  TenantVerifier,
  generateId,
  TenantRevoker,
} from "pagopa-interop-models";

import { config } from "../src/config/config.js";
import { dbContext } from "./utils.js";

const currentDate = new Date();

// tenant_mail is no longer part of the Analytics models, but the table is
// still in the schema until it is dropped (PIN-11292): it is read directly.
export const countTenantMailRows = async (
  tenantId: string
): Promise<number> => {
  const { count } = await dbContext.conn.one<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM ${config.dbSchemaName}.tenant_mail WHERE tenant_id = $1`,
    [tenantId]
  );
  return count;
};

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
