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
  KafkaBatchConsumerConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const EventsSignerConfig = CatalogTopicConfig.and(AgreementTopicConfig)
  .and(AuthorizationTopicConfig)
  .and(PurposeTopicConfig)
  .and(DelegationTopicConfig)
  .and(CatalogTopicConfig)
  .and(FileManagerConfig)
  .and(S3Config)
  .and(LoggerConfig)
  .and(KafkaBatchConsumerConfig)
  .and(
    z
      .object({
        DB_TABLE_NAME: z.string(),
      })
      .transform((c) => ({
        dbTableName: c.DB_TABLE_NAME,
      }))
  );

export type EventsSignerConfig = z.infer<typeof EventsSignerConfig>;

export const config: EventsSignerConfig = EventsSignerConfig.parse(process.env);

export const baseConsumerConfig: KafkaConsumerConfig =
  KafkaConsumerConfig.parse(process.env);

export const batchConsumerConfig: KafkaBatchConsumerConfig =
  KafkaBatchConsumerConfig.parse(process.env);
