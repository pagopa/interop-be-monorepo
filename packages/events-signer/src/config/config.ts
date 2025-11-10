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
  EventsSignerConfig,
  SafeStorageApiConfig,
  DynamoDBClientConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const EventSignerConfig = CatalogTopicConfig.and(AgreementTopicConfig)
  .and(AuthorizationTopicConfig)
  .and(PurposeTopicConfig)
  .and(DelegationTopicConfig)
  .and(FileManagerConfig)
  .and(S3Config)
  .and(LoggerConfig)
  .and(KafkaBatchConsumerConfig)
  .and(EventsSignerConfig)
  .and(SafeStorageApiConfig)
  .and(DynamoDBClientConfig)
  .and(
    z
      .object({
        SERVICE_NAME: z.string(),
      })
      .transform((c) => ({
        serviceName: c.SERVICE_NAME,
      }))
  );

export type EventSignerConfig = z.infer<typeof EventSignerConfig>;

export const config: EventSignerConfig = EventSignerConfig.parse(process.env);

export const baseConsumerConfig: KafkaConsumerConfig =
  KafkaConsumerConfig.parse(process.env);

export const batchConsumerConfig: KafkaBatchConsumerConfig =
  KafkaBatchConsumerConfig.parse(process.env);
