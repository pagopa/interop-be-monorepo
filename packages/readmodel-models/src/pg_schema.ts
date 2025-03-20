import { pgSchema } from "drizzle-orm/pg-core";
import { ReadModelSQLDbConfig } from "pagopa-interop-commons";

const config = ReadModelSQLDbConfig.parse(process.env);

export const readmodelAgreement = pgSchema(
  `${config.readModelSQLDbSchemaNamespace}_readmodel_agreement`
);
export const readmodelProducerKeychain = pgSchema(
  `${config.readModelSQLDbSchemaNamespace}_readmodel_producer_keychain`
);
export const readmodelClient = pgSchema(
  `${config.readModelSQLDbSchemaNamespace}_readmodel_client`
);
export const readmodelAttribute = pgSchema(
  `${config.readModelSQLDbSchemaNamespace}_readmodel_attribute`
);
export const readmodelDelegation = pgSchema(
  `${config.readModelSQLDbSchemaNamespace}_readmodel_delegation`
);
export const readmodelCatalog = pgSchema(
  `${config.readModelSQLDbSchemaNamespace}_readmodel_catalog`
);
export const readmodelPurpose = pgSchema(
  `${config.readModelSQLDbSchemaNamespace}_readmodel_purpose`
);
export const readmodelClientJwkKey = pgSchema(
  `${config.readModelSQLDbSchemaNamespace}_readmodel_client_jwk_key`
);
export const readmodelProducerJwkKey = pgSchema(
  `${config.readModelSQLDbSchemaNamespace}_readmodel_producer_jwk_key`
);
export const readmodelTenant = pgSchema(
  `${config.readModelSQLDbSchemaNamespace}_readmodel_tenant`
);
