import {
  PurposeTopicConfig,
  KafkaConsumerConfig,
  KafkaProducerConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const PurposeOutboundWriterConfig = KafkaConsumerConfig.and(KafkaProducerConfig)
  .and(PurposeTopicConfig)
  .and(
    z.object({
      PURPOSE_OUTBOUND_TOPIC: z.string(),
    })
  )
  .transform((c) => ({
    ...c,
    purposeOutboundTopic: c.PURPOSE_OUTBOUND_TOPIC,
  }));

type PurposeOutboundWriterConfig = z.infer<typeof PurposeOutboundWriterConfig>;

export const config: PurposeOutboundWriterConfig =
  PurposeOutboundWriterConfig.parse(process.env);
