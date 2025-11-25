/* eslint-disable local-rules/no-unsafe-object-spread */
import {
  TenantTopicConfig,
  KafkaConsumerConfig,
  KafkaProducerConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const TenantOutboundWriterConfig = KafkaConsumerConfig.and(KafkaProducerConfig)
  .and(TenantTopicConfig)
  .and(
    z.object({
      TENANT_OUTBOUND_TOPIC: z.string(),
    })
  )
  .transform((c) => ({
    ...c,
    tenantOutboundTopic: c.TENANT_OUTBOUND_TOPIC,
  }));

export type TenantOutboundWriterConfig = z.infer<
  typeof TenantOutboundWriterConfig
>;

export const config: TenantOutboundWriterConfig =
  TenantOutboundWriterConfig.parse(process.env);
