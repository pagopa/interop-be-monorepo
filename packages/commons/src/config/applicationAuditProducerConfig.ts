import { z } from "zod";
import { KafkaProducerConfig } from "./producerServiceConfig.js";
import { ApplicationAuditTopicConfig } from "./kafkaTopicConfig.js";

export const ApplicationAuditProducerConfig = z
  .object({
    INT_PROP: z.number(),
    STRING_PROP: z.string(),
  })
  .transform((c) => ({
    intProp: c.INT_PROP,
    stringProp: c.STRING_PROP,
  }))
  .and(KafkaProducerConfig)
  .and(ApplicationAuditTopicConfig);

export type ApplicationAuditProducerConfig = z.infer<
  typeof ApplicationAuditProducerConfig
>;
