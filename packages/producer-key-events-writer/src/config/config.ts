import {
  AuthorizationTopicConfig,
  EventStoreConfig,
  KafkaConsumerConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const ProducerKeyReadModelWriterConfig =
  AuthorizationTopicConfig.and(EventStoreConfig).and(KafkaConsumerConfig);

type ProducerKeyReadModelWriterConfig = z.infer<
  typeof ProducerKeyReadModelWriterConfig
>;

export const config: ProducerKeyReadModelWriterConfig =
  ProducerKeyReadModelWriterConfig.parse(process.env);
