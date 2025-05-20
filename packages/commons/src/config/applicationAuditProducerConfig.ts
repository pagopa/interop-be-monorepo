import { z } from "zod";
import { KafkaProducerConfig } from "./producerServiceConfig.js";
import { ApplicationAuditTopicConfig } from "./kafkaTopicConfig.js";
import { ApplicationAuditFallbackSQSProducerConfig } from "./applicationAuditFallbackSQSProducerConfig.js";
import { LoggerConfig } from "./loggerConfig.js";

export const ApplicationAuditProducerConfig = z
  .object({
    SERVICE_VERSION: z.string(),
    NODE_IP: z.string(),
    POD_NAME: z.string(),
  })
  .transform((c) => ({
    serviceVersion: c.SERVICE_VERSION,
    nodeIp: c.NODE_IP,
    podName: c.POD_NAME,
  }))
  .and(KafkaProducerConfig)
  .and(ApplicationAuditTopicConfig)
  .and(ApplicationAuditFallbackSQSProducerConfig)
  .and(LoggerConfig);

export type ApplicationAuditProducerConfig = z.infer<
  typeof ApplicationAuditProducerConfig
>;
