import { z } from "zod";
import { KafkaProducerConfig } from "./producerServiceConfig.js";
import { ApplicationAuditTopicConfig } from "./kafkaTopicConfig.js";

export const ApplicationAuditProducerConfig = z
  .object({
    SERVICE_VERSION: z.string(),
    NODE_IP: z.string(),
    POD_NAME: z.string(),
    AMAZON_TRACE_ID: z.string(),
  })
  .transform((c) => ({
    serviceVersion: c.SERVICE_VERSION,
    nodeIp: c.NODE_IP,
    podName: c.POD_NAME,
    amazonTraceId: c.AMAZON_TRACE_ID,
  }))
  .and(KafkaProducerConfig)
  .and(ApplicationAuditTopicConfig);

export type ApplicationAuditProducerConfig = z.infer<
  typeof ApplicationAuditProducerConfig
>;
