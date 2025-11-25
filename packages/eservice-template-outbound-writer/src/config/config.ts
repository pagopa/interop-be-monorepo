import {
  EServiceTemplateTopicConfig,
  KafkaConsumerConfig,
  KafkaProducerConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const EServiceTemplateOutboundWriterConfig = KafkaConsumerConfig.and(
  KafkaProducerConfig
)
  .and(EServiceTemplateTopicConfig)
  .and(
    z.object({
      ESERVICE_TEMPLATE_OUTBOUND_TOPIC: z.string(),
    })
  )
  /* eslint-disable local-rules/no-unsafe-object-spread */
  .transform((c) => ({
    ...c,
    eserviceTemplateOutboundTopic: c.ESERVICE_TEMPLATE_OUTBOUND_TOPIC,
  }));

export type EServiceTemplateOutboundWriterConfig = z.infer<
  typeof EServiceTemplateOutboundWriterConfig
>;

export const config: EServiceTemplateOutboundWriterConfig =
  EServiceTemplateOutboundWriterConfig.parse(process.env);
