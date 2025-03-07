import { z } from "zod";
import { KafkaProducerConfig } from "./producerServiceConfig.js";
import { ApplicationAuditTopicConfig } from "./kafkaTopicConfig.js";

export const ApplicationAuditProducerConfig = z
  .object({
    SERVICE_VERSION: z.string(),
    NODE_IP: z.string(),
    POD_NAME: z.string(),
    ENDPOINTS_WITHOUT_AUDIT: z.string().optional(),
  })
  .transform((c) => ({
    serviceVersion: c.SERVICE_VERSION,
    nodeIp: c.NODE_IP,
    podName: c.POD_NAME,
    endpointsWithoutAudit: c.ENDPOINTS_WITHOUT_AUDIT?.split(","),
  }))
  .and(KafkaProducerConfig)
  .and(ApplicationAuditTopicConfig);

export type ApplicationAuditProducerConfig = z.infer<
  typeof ApplicationAuditProducerConfig
>;
