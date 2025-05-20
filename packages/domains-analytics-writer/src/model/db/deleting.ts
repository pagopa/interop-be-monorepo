import { z } from "zod";
import {
  attributeInReadmodelAttribute,
  clientInReadmodelClient,
  clientUserInReadmodelClient,
  clientPurposeInReadmodelClient,
  clientKeyInReadmodelClient,
  eserviceInReadmodelCatalog,
  eserviceRiskAnalysisInReadmodelCatalog,
} from "pagopa-interop-readmodel-models";

import { AttributeDeletingSchema } from "../attribute/attribute.js";
import { EserviceDeletingSchema } from "../catalog/eservice.js";
import { EserviceRiskAnalysisDeletingSchema } from "../catalog/eserviceRiskAnalysis.js";
import { ClientDeletingSchema } from "../authorization/client.js";
import { ClientUserDeletingSchema } from "../authorization/clientUser.js";
import { ClientPurposeDeletingSchema } from "../authorization/clientPurpose.js";
import { ClientKeyDeletingSchema } from "../authorization/clientKey.js";

export const DeletingDbTableConfig = {
  attribute_deleting_table: AttributeDeletingSchema,
  catalog_deleting_table: EserviceDeletingSchema,
  catalog_risk_deleting_table: EserviceRiskAnalysisDeletingSchema,
  client_deleting_table: ClientDeletingSchema,
  client_user_deleting_table: ClientUserDeletingSchema,
  client_purpose_deleting_table: ClientPurposeDeletingSchema,
  client_key_deleting_table: ClientKeyDeletingSchema,
} as const;
export type DeletingDbTableConfig = typeof DeletingDbTableConfig;

export const DeletingDbTableReadModel = {
  attribute_deleting_table: attributeInReadmodelAttribute,
  catalog_deleting_table: eserviceInReadmodelCatalog,
  catalog_risk_deleting_table: eserviceRiskAnalysisInReadmodelCatalog,
  client_deleting_table: clientInReadmodelClient,
  client_user_deleting_table: clientUserInReadmodelClient,
  client_purpose_deleting_table: clientPurposeInReadmodelClient,
  client_key_deleting_table: clientKeyInReadmodelClient,
} as const;
export type DeletingDbTableReadModel = typeof DeletingDbTableReadModel;

export type DeletingDbTable = keyof DeletingDbTableConfig;

export const DeletingDbTable = Object.fromEntries(
  Object.keys(DeletingDbTableConfig).map((k) => [k, k])
) as { [K in DeletingDbTable]: K };

export type DeletingDbTableConfigMap = {
  [K in keyof DeletingDbTableConfig]: {
    name: K;
    columns: ReadonlyArray<keyof z.infer<DeletingDbTableConfig[K]>>;
  };
}[keyof DeletingDbTableConfig];
