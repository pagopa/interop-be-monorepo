import { pgSchema } from "drizzle-orm/pg-core";
import { ReadModelSQLDbConfig } from "pagopa-interop-commons";

const config = ReadModelSQLDbConfig.parse(process.env);

export const readmodelAgreement = pgSchema(
  config.readModelSQLDbSchemaAgreement
);
export const readmodelProducerKeychain = pgSchema(
  config.readModelSQLDbSchemaProducerKeychain
);
export const readmodelClient = pgSchema(config.readModelSQLDbSchemaClient);
export const readmodelAttribute = pgSchema(
  config.readModelSQLDbSchemaAttribute
);
export const readmodelDelegation = pgSchema(
  config.readModelSQLDbSchemaDelegation
);
export const readmodelCatalog = pgSchema(config.readModelSQLDbSchemaCatalog);
export const readmodelPurpose = pgSchema(config.readModelSQLDbSchemaPurpose);
export const readmodelClientJwkKey = pgSchema(
  config.readModelSQLDbSchemaClientJwkKey
);
export const readmodelProducerJwkKey = pgSchema(
  config.readModelSQLDbSchemaProducerJwkKey
);
export const readmodelTenant = pgSchema(config.readModelSQLDbSchemaTenant);
export const readmodelEserviceTemplate = pgSchema(
  config.readModelSQLDbSchemaEServiceTemplate
);
export const readmodelNotificationConfig = pgSchema(
  config.readModelSQLDbSchemaNotificationConfig
);
export const readmodelPurposeTemplate = pgSchema(
  config.readModelSQLDbSchemaPurposeTemplate
);
