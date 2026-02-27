import { z } from "zod";

export const ReadModelSQLDbConfig = z
  .object({
    READMODEL_SQL_DB_HOST: z.string().default("localhost"),
    READMODEL_SQL_DB_NAME: z.string().default("root"),
    READMODEL_SQL_DB_USERNAME: z.string().default("root"),
    READMODEL_SQL_DB_PASSWORD: z.string().default("root"),
    READMODEL_SQL_DB_PORT: z.coerce.number().min(1001).default(6002),
    READMODEL_SQL_DB_USE_SSL: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .default("false"),
    READMODEL_SQL_DB_SCHEMA_AGREEMENT: z
      .string()
      .default("readmodel_agreement"),
    READMODEL_SQL_DB_SCHEMA_ATTRIBUTE: z
      .string()
      .default("readmodel_attribute"),
    READMODEL_SQL_DB_SCHEMA_CATALOG: z.string().default("readmodel_catalog"),
    READMODEL_SQL_DB_SCHEMA_CLIENT_JWK_KEY: z
      .string()
      .default("readmodel_client_jwk_key"),
    READMODEL_SQL_DB_SCHEMA_CLIENT: z.string().default("readmodel_client"),
    READMODEL_SQL_DB_SCHEMA_DELEGATION: z
      .string()
      .default("readmodel_delegation"),
    READMODEL_SQL_DB_SCHEMA_ESERVICE_TEMPLATE: z
      .string()
      .default("readmodel_eservice_template"),
    READMODEL_SQL_DB_SCHEMA_NOTIFICATION_CONFIG: z
      .string()
      .default("readmodel_notification_config"),
    READMODEL_SQL_DB_SCHEMA_PRODUCER_JWK_KEY: z
      .string()
      .default("readmodel_producer_jwk_key"),
    READMODEL_SQL_DB_SCHEMA_PRODUCER_KEYCHAIN: z
      .string()
      .default("readmodel_producer_keychain"),
    READMODEL_SQL_DB_SCHEMA_PURPOSE: z.string().default("readmodel_purpose"),
    READMODEL_SQL_DB_SCHEMA_PURPOSE_TEMPLATE: z
      .string()
      .default("readmodel_purpose_template"),
    READMODEL_SQL_DB_SCHEMA_TENANT: z.string().default("readmodel_tenant"),
  })
  .transform((c) => ({
    readModelSQLDbHost: c.READMODEL_SQL_DB_HOST,
    readModelSQLDbName: c.READMODEL_SQL_DB_NAME,
    readModelSQLDbUsername: c.READMODEL_SQL_DB_USERNAME,
    readModelSQLDbPassword: c.READMODEL_SQL_DB_PASSWORD,
    readModelSQLDbPort: c.READMODEL_SQL_DB_PORT,
    readModelSQLDbUseSSL: c.READMODEL_SQL_DB_USE_SSL,
    readModelSQLDbSchemaAgreement: c.READMODEL_SQL_DB_SCHEMA_AGREEMENT,
    readModelSQLDbSchemaAttribute: c.READMODEL_SQL_DB_SCHEMA_ATTRIBUTE,
    readModelSQLDbSchemaCatalog: c.READMODEL_SQL_DB_SCHEMA_CATALOG,
    readModelSQLDbSchemaClientJwkKey: c.READMODEL_SQL_DB_SCHEMA_CLIENT_JWK_KEY,
    readModelSQLDbSchemaClient: c.READMODEL_SQL_DB_SCHEMA_CLIENT,
    readModelSQLDbSchemaDelegation: c.READMODEL_SQL_DB_SCHEMA_DELEGATION,
    readModelSQLDbSchemaEServiceTemplate:
      c.READMODEL_SQL_DB_SCHEMA_ESERVICE_TEMPLATE,
    readModelSQLDbSchemaNotificationConfig:
      c.READMODEL_SQL_DB_SCHEMA_NOTIFICATION_CONFIG,
    readModelSQLDbSchemaProducerJwkKey:
      c.READMODEL_SQL_DB_SCHEMA_PRODUCER_JWK_KEY,
    readModelSQLDbSchemaProducerKeychain:
      c.READMODEL_SQL_DB_SCHEMA_PRODUCER_KEYCHAIN,
    readModelSQLDbSchemaPurpose: c.READMODEL_SQL_DB_SCHEMA_PURPOSE,
    readModelSQLDbSchemaPurposeTemplate:
      c.READMODEL_SQL_DB_SCHEMA_PURPOSE_TEMPLATE,
    readModelSQLDbSchemaTenant: c.READMODEL_SQL_DB_SCHEMA_TENANT,
  }));

export type ReadModelSQLDbConfig = z.infer<typeof ReadModelSQLDbConfig>;
