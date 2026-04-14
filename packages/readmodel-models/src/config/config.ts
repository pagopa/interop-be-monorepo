import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { ReadModelSQLDbConfig } from "pagopa-interop-commons";

export const config = ReadModelSQLDbConfig.parse(process.env);

export default defineConfig({
  out: "./src/generated",
  dialect: "postgresql",
  dbCredentials: {
    host: config.readModelSQLDbHost,
    port: config.readModelSQLDbPort,
    user: config.readModelSQLDbUsername,
    password: config.readModelSQLDbPassword,
    database: config.readModelSQLDbName,
    ssl: config.readModelSQLDbUseSSL,
  },
  schemaFilter: [
    config.readModelSQLDbSchemaAgreement,
    config.readModelSQLDbSchemaAttribute,
    config.readModelSQLDbSchemaCatalog,
    config.readModelSQLDbSchemaClientJwkKey,
    config.readModelSQLDbSchemaClient,
    config.readModelSQLDbSchemaDelegation,
    config.readModelSQLDbSchemaEServiceTemplate,
    config.readModelSQLDbSchemaNotificationConfig,
    config.readModelSQLDbSchemaProducerJwkKey,
    config.readModelSQLDbSchemaProducerKeychain,
    config.readModelSQLDbSchemaPurpose,
    config.readModelSQLDbSchemaPurposeTemplate,
    config.readModelSQLDbSchemaTenant,
  ],
});
