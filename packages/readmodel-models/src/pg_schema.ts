import { pgSchema } from "drizzle-orm/pg-core";

const readModelSQLDbSchemaNamespace =
  process.env.READMODEL_SQL_DB_SCHEMA_NAMESPACE || "fallback";

// if (process.env.READMODEL_SQL_DB_SCHEMA_NAMESPACE) {
//   throw genericInternalError("Schema namespace is missing in env");
// }

export const readmodelAgreement = pgSchema(
  `${readModelSQLDbSchemaNamespace}_readmodel_agreement`
);
export const readmodelProducerKeychain = pgSchema(
  `${readModelSQLDbSchemaNamespace}_readmodel_producer_keychain`
);
export const readmodelClient = pgSchema(
  `${readModelSQLDbSchemaNamespace}_readmodel_client`
);
export const readmodelAttribute = pgSchema(
  `${readModelSQLDbSchemaNamespace}_readmodel_attribute`
);
export const readmodelDelegation = pgSchema(
  `${readModelSQLDbSchemaNamespace}_readmodel_delegation`
);
export const readmodelCatalog = pgSchema(
  `${readModelSQLDbSchemaNamespace}_readmodel_catalog`
);
export const readmodelPurpose = pgSchema(
  `${readModelSQLDbSchemaNamespace}_readmodel_purpose`
);
export const readmodelClientJwkKey = pgSchema(
  `${readModelSQLDbSchemaNamespace}_readmodel_client_jwk_key`
);
export const readmodelProducerJwkKey = pgSchema(
  `${readModelSQLDbSchemaNamespace}_readmodel_producer_jwk_key`
);
export const readmodelTenant = pgSchema(
  `${readModelSQLDbSchemaNamespace}_readmodel_tenant`
);
