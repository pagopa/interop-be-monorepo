import { z } from "zod";

export const ReadModelSQLDbConfig = z
  .object({
    READMODEL_SQL_DB_HOST: z.string(),
    READMODEL_SQL_DB_NAME: z.string(),
    READMODEL_SQL_DB_USERNAME: z.string(),
    READMODEL_SQL_DB_PASSWORD: z.string(),
    READMODEL_SQL_DB_PORT: z.coerce.number().min(1001),
    READMODEL_SQL_DB_USE_SSL: z
      .enum(["true", "false"])
      .transform((value) => value === "true"),
    READMODEL_SQL_DB_SCHEMA_AGREEMENT: z.string(),
    READMODEL_SQL_DB_SCHEMA_ATTRIBUTE: z.string(),
    READMODEL_SQL_DB_SCHEMA_CATALOG: z.string(),
    READMODEL_SQL_DB_SCHEMA_CLIENT_JWK_KEY: z.string(),
    READMODEL_SQL_DB_SCHEMA_CLIENT: z.string(),
    READMODEL_SQL_DB_SCHEMA_DELEGATION: z.string(),
    READMODEL_SQL_DB_SCHEMA_ESERVICE_TEMPLATE: z.string(),
    READMODEL_SQL_DB_SCHEMA_PRODUCER_JWK_KEY: z.string(),
    READMODEL_SQL_DB_SCHEMA_PRODUCER_KEYCHAIN: z.string(),
    READMODEL_SQL_DB_SCHEMA_PURPOSE: z.string(),
    READMODEL_SQL_DB_SCHEMA_TENANT: z.string(),
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
    readModelSQLDbSchemaProducerJwkKey:
      c.READMODEL_SQL_DB_SCHEMA_PRODUCER_JWK_KEY,
    readModelSQLDbSchemaProducerKeychain:
      c.READMODEL_SQL_DB_SCHEMA_PRODUCER_KEYCHAIN,
    readModelSQLDbSchemaPurpose: c.READMODEL_SQL_DB_SCHEMA_PURPOSE,
    readModelSQLDbSchemaTenant: c.READMODEL_SQL_DB_SCHEMA_TENANT,
  }));

export type ReadModelSQLDbConfig = z.infer<typeof ReadModelSQLDbConfig>;
