import {
  DelegationTopicConfig,
  KafkaConsumerConfig,
  KafkaProducerConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const DelegationOutboundWriterConfig = KafkaConsumerConfig.and(
  KafkaProducerConfig
)
  .and(DelegationTopicConfig)
  .and(
    z.object({
      DELEGATION_OUTBOUND_TOPIC: z.string(),
    })
  )
  .transform((c) => ({
    ...c,
    delegationOutboundTopic: c.DELEGATION_OUTBOUND_TOPIC,
  }));

type DelegationOutboundWriterConfig = z.infer<
  typeof DelegationOutboundWriterConfig
>;

export const config: DelegationOutboundWriterConfig =
  DelegationOutboundWriterConfig.parse(process.env);
