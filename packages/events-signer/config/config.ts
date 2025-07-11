import {
  AgreementTopicConfig,
  KafkaConsumerConfig,
  CatalogTopicConfig,
  PurposeTopicConfig,
  AuthorizationTopicConfig,
  DelegationTopicConfig,
  FileManagerConfig,
  LoggerConfig,
  S3Config,
} from "pagopa-interop-commons";
import { z } from "zod";

export const EventsSignerConfig = KafkaConsumerConfig.and(CatalogTopicConfig)
  .and(AgreementTopicConfig)
  .and(AuthorizationTopicConfig)
  .and(PurposeTopicConfig)
  .and(DelegationTopicConfig)
  .and(CatalogTopicConfig)
  .and(FileManagerConfig)
  .and(S3Config)
  .and(LoggerConfig);

export type EventsSignerConfig = z.infer<typeof EventsSignerConfig>;

export const config: EventsSignerConfig = EventsSignerConfig.parse(process.env);
