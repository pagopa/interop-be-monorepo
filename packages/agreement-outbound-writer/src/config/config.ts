import {
  AgreementTopicConfig,
  KafkaConsumerConfig,
  KafkaProducerConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const AgreementOutboundWriterConfig = KafkaConsumerConfig.and(
  KafkaProducerConfig
)
  .and(AgreementTopicConfig)
  .and(
    z.object({
      AGREEMENT_OUTBOUND_TOPIC: z.string(),
    })
  )
  .transform((c) => ({
    ...c,
    agreementOutboundTopic: c.AGREEMENT_OUTBOUND_TOPIC,
  }));

type AgreementOutboundWriterConfig = z.infer<
  typeof AgreementOutboundWriterConfig
>;

export const config: AgreementOutboundWriterConfig =
  AgreementOutboundWriterConfig.parse(process.env);
