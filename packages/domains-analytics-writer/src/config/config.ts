import {
  AgreementTopicConfig,
  KafkaConsumerConfig,
  CatalogTopicConfig,
  PurposeTopicConfig,
  AuthorizationTopicConfig,
  AttributeTopicConfig,
  TenantTopicConfig,
  DelegationTopicConfig,
  KafkaBatchConsumerConfig,
  LoggerConfig,
  EServiceTemplateTopicConfig,
} from "pagopa-interop-commons";
import { z } from "zod";
import { DbConfig } from "./dbConfig.js";

export const DomainsAnalyticsWriterConfig = KafkaConsumerConfig.and(
  KafkaBatchConsumerConfig
)
  .and(LoggerConfig)
  .and(CatalogTopicConfig)
  .and(AgreementTopicConfig)
  .and(AttributeTopicConfig)
  .and(PurposeTopicConfig)
  .and(CatalogTopicConfig)
  .and(TenantTopicConfig)
  .and(AuthorizationTopicConfig)
  .and(DelegationTopicConfig)
  .and(EServiceTemplateTopicConfig)
  .and(DbConfig)
  .and(
    z
      .object({
        MERGE_TABLE_SUFFIX: z
          .string()
          .transform((val) => val.replace(/-/g, "")),
        SERVICE_NAME: z.string(),
      })
      .transform((c) => ({
        mergeTableSuffix: c.MERGE_TABLE_SUFFIX,
        serviceName: c.SERVICE_NAME,
      }))
  );

export type DomainsAnalyticsWriterConfig = z.infer<
  typeof DomainsAnalyticsWriterConfig
>;

export const config: DomainsAnalyticsWriterConfig =
  DomainsAnalyticsWriterConfig.parse(process.env);

export const baseConsumerConfig: KafkaConsumerConfig =
  KafkaConsumerConfig.parse(process.env);

export const batchConsumerConfig: KafkaBatchConsumerConfig =
  KafkaBatchConsumerConfig.parse(process.env);
