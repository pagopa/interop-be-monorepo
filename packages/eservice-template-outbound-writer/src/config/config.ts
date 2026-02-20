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
  .transform((c) => ({
    ...c,
    eserviceTemplateOutboundTopic: c.ESERVICE_TEMPLATE_OUTBOUND_TOPIC,
  }));

type EServiceTemplateOutboundWriterConfig = z.infer<
  typeof EServiceTemplateOutboundWriterConfig
>;

export const config: EServiceTemplateOutboundWriterConfig =
  EServiceTemplateOutboundWriterConfig.parse(process.env);
