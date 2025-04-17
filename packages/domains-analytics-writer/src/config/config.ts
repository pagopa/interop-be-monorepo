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
  AnalyticsSQLDbConfig,
  ReadModelSQLDbConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

// We explicitly set these environment variables here because
// the `pagopa-interop-readmodel-models` and `pagopa-interop-readmodel` packages
// require a fully configured READMODEL_SQL_DB environment in order to work.
// so we must be sure that env is set up before any import or usage happens.

// These packages are needed to use splitter into SQL functions like `splitAttributeIntoObjectsSQL` and models like `AttributeSQL`,
export const readModelSetupEnv = {
  READMODEL_SQL_DB_HOST: "localhost",
  READMODEL_SQL_DB_PORT: "6002",
  READMODEL_SQL_DB_USERNAME: "root",
  READMODEL_SQL_DB_PASSWORD: "root",
  READMODEL_SQL_DB_NAME: "root",
  READMODEL_SQL_DB_USE_SSL: "false",
  READMODEL_SQL_DB_SCHEMA_AGREEMENT: "readmodel_agreement",
  READMODEL_SQL_DB_SCHEMA_ATTRIBUTE: "readmodel_attribute",
  READMODEL_SQL_DB_SCHEMA_CATALOG: "readmodel_catalog",
  READMODEL_SQL_DB_SCHEMA_CLIENT_JWK_KEY: "readmodel_client_jwk_key",
  READMODEL_SQL_DB_SCHEMA_CLIENT: "readmodel_client",
  READMODEL_SQL_DB_SCHEMA_DELEGATION: "readmodel_delegation",
  READMODEL_SQL_DB_SCHEMA_ESERVICE_TEMPLATE: "readmodel_eservice_template",
  READMODEL_SQL_DB_SCHEMA_PRODUCER_JWK_KEY: "readmodel_producer_jwk_key",
  READMODEL_SQL_DB_SCHEMA_PRODUCER_KEYCHAIN: "readmodel_producer_keychain",
  READMODEL_SQL_DB_SCHEMA_PURPOSE: "readmodel_purpose",
  READMODEL_SQL_DB_SCHEMA_TENANT: "readmodel_tenant",
};
Object.entries(readModelSetupEnv).forEach(([key, value]) => {
  // eslint-disable-next-line functional/immutable-data
  process.env[key] = value;
});

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
  .and(AnalyticsSQLDbConfig)
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
  )
  .and(ReadModelSQLDbConfig);

export type DomainsAnalyticsWriterConfig = z.infer<
  typeof DomainsAnalyticsWriterConfig
>;

export const config: DomainsAnalyticsWriterConfig =
  DomainsAnalyticsWriterConfig.parse({
    ...process.env,
    ...readModelSetupEnv,
  });

export const baseConsumerConfig: KafkaConsumerConfig =
  KafkaConsumerConfig.parse(process.env);

export const batchConsumerConfig: KafkaBatchConsumerConfig =
  KafkaBatchConsumerConfig.parse(process.env);
