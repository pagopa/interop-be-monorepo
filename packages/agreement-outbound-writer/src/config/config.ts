import {
  AgreementTopicConfig,
  EventStoreConfig,
  KafkaConsumerConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const AgreementOutboundWriterConfig =
  KafkaConsumerConfig.and(AgreementTopicConfig).and(EventStoreConfig);

export type AgreementOutboundWriterConfig = z.infer<
  typeof AgreementOutboundWriterConfig
>;

export const config: AgreementOutboundWriterConfig =
  AgreementOutboundWriterConfig.parse(process.env);
