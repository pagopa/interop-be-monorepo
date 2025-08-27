import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { ReadModelSQLDbConfig } from "pagopa-interop-commons";

const readmodelDBConfig = ReadModelSQLDbConfig.parse(process.env);

export default defineConfig({
  out: "./src/drizzle",
  dialect: "postgresql",
  dbCredentials: {
    host: readmodelDBConfig.readModelSQLDbHost,
    port: readmodelDBConfig.readModelSQLDbPort,
    user: readmodelDBConfig.readModelSQLDbUsername,
    password: readmodelDBConfig.readModelSQLDbPassword,
    database: readmodelDBConfig.readModelSQLDbName,
    ssl: readmodelDBConfig.readModelSQLDbUseSSL,
  },
  schemaFilter: [
    readmodelDBConfig.readModelSQLDbSchemaAgreement,
    readmodelDBConfig.readModelSQLDbSchemaAttribute,
    readmodelDBConfig.readModelSQLDbSchemaCatalog,
    readmodelDBConfig.readModelSQLDbSchemaClientJwkKey,
    readmodelDBConfig.readModelSQLDbSchemaClient,
    readmodelDBConfig.readModelSQLDbSchemaDelegation,
    readmodelDBConfig.readModelSQLDbSchemaEServiceTemplate,
    readmodelDBConfig.readModelSQLDbSchemaNotificationConfig,
    readmodelDBConfig.readModelSQLDbSchemaProducerJwkKey,
    readmodelDBConfig.readModelSQLDbSchemaProducerKeychain,
    readmodelDBConfig.readModelSQLDbSchemaPurpose,
    readmodelDBConfig.readModelSQLDbSchemaPurposeTemplate,
    readmodelDBConfig.readModelSQLDbSchemaTenant,
  ],
});
