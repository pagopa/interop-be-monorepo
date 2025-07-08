import {
  AgreementTopicConfig,
  KafkaConsumerConfig,
  CatalogTopicConfig,
  PurposeTopicConfig,
  AuthorizationTopicConfig,
  DelegationTopicConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const EventsSignerConfig = KafkaConsumerConfig.and(CatalogTopicConfig)
  .and(AgreementTopicConfig)
  .and(AuthorizationTopicConfig)
  .and(PurposeTopicConfig)
  .and(DelegationTopicConfig)
  .and(CatalogTopicConfig);

export type EventsSignerConfig = z.infer<typeof EventsSignerConfig>;

export const config: EventsSignerConfig = EventsSignerConfig.parse(process.env);
