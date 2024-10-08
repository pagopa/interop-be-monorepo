import {
  AuthorizationTopicConfig,
  EventStoreConfig,
  KafkaConsumerConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const ProducerKeyReadModelWriterConfig =
  AuthorizationTopicConfig.and(EventStoreConfig).and(KafkaConsumerConfig);

export type ProducerKeyReadModelWriterConfig = z.infer<
  typeof ProducerKeyReadModelWriterConfig
>;

export const config: ProducerKeyReadModelWriterConfig =
  ProducerKeyReadModelWriterConfig.parse(process.env);
