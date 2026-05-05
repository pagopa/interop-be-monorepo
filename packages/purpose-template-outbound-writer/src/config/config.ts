import {
  PurposeTemplateTopicConfig,
  KafkaConsumerConfig,
  KafkaProducerConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const PurposeOutboundWriterConfig = KafkaConsumerConfig.and(KafkaProducerConfig)
  .and(PurposeTemplateTopicConfig)
  .and(
    z.object({
      PURPOSE_TEMPLATE_OUTBOUND_TOPIC: z.string(),
    })
  )
  .transform((c) => ({
    ...c,
    purposeTemplateOutboundTopic: c.PURPOSE_TEMPLATE_OUTBOUND_TOPIC,
  }));

type PurposeOutboundWriterConfig = z.infer<typeof PurposeOutboundWriterConfig>;

export const config: PurposeOutboundWriterConfig =
  PurposeOutboundWriterConfig.parse(process.env);
