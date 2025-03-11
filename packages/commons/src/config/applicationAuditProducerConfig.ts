import { z } from "zod";
import { KafkaProducerConfig } from "./producerServiceConfig.js";
import { ApplicationAuditTopicConfig } from "./kafkaTopicConfig.js";

export const ApplicationAuditProducerConfig = z
  .object({
    SERVICE_VERSION: z.string(),
    NODE_IP: z.string(),
    POD_NAME: z.string(),
    ENDPOINTS_WITH_CUSTOM_AUDIT: z.string().optional(),
  })
  .transform((c) => ({
    serviceVersion: c.SERVICE_VERSION,
    nodeIp: c.NODE_IP,
    podName: c.POD_NAME,
    endpointsWithCustomAudit: c.ENDPOINTS_WITH_CUSTOM_AUDIT?.split(","),
  }))
  .and(KafkaProducerConfig)
  .and(ApplicationAuditTopicConfig);

export type ApplicationAuditProducerConfig = z.infer<
  typeof ApplicationAuditProducerConfig
>;
