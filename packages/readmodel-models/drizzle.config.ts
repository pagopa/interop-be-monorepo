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
    "readmodel_agreement",
    "readmodel_attribute",
    "readmodel_catalog",
    "readmodel_client_jwk_key",
    "readmodel_client",
    "readmodel_delegation",
    "readmodel_eservice_template",
    "readmodel_producer_jwk_key",
    "readmodel_producer_keychain",
    "readmodel_purpose",
    "readmodel_tenant",
  ],
});
