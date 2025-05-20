import { z } from "zod";
import {
  attributeInReadmodelAttribute,
  eserviceInReadmodelCatalog,
  eserviceRiskAnalysisInReadmodelCatalog,
  tenantFeatureInReadmodelTenant,
  tenantInReadmodelTenant,
  tenantMailInReadmodelTenant,
} from "pagopa-interop-readmodel-models";

import { AttributeDeletingSchema } from "../attribute/attribute.js";
import { EserviceDeletingSchema } from "../catalog/eservice.js";
import { EserviceRiskAnalysisDeletingSchema } from "../catalog/eserviceRiskAnalysis.js";
import { TenantDeletingSchema } from "../tenant/tenant.js";
import { TenantMailDeletingByIdAndTenantSchema } from "../tenant/tenantMail.js";
import { TenantFeatureDeletingSchema } from "../tenant/tenantFeature.js";

export const DeletingDbTableConfig = {
  attribute_deleting_table: AttributeDeletingSchema,
  catalog_deleting_table: EserviceDeletingSchema,
  catalog_risk_deleting_table: EserviceRiskAnalysisDeletingSchema,
  tenant_deleting_table: TenantDeletingSchema,
  tenant_mail_deleting_table: TenantMailDeletingByIdAndTenantSchema,
  tenant_feature_deleting_table: TenantFeatureDeletingSchema,
} as const;
export type DeletingDbTableConfig = typeof DeletingDbTableConfig;

export const DeletingDbTableReadModel = {
  attribute_deleting_table: attributeInReadmodelAttribute,
  catalog_deleting_table: eserviceInReadmodelCatalog,
  catalog_risk_deleting_table: eserviceRiskAnalysisInReadmodelCatalog,
  tenant_deleting_table: tenantInReadmodelTenant,
  tenant_mail_deleting_table: tenantMailInReadmodelTenant,
  tenant_feature_deleting_table: tenantFeatureInReadmodelTenant,
} as const;
export type DeletingDbTableReadModel = typeof DeletingDbTableReadModel;

export type DeletingDbTable = keyof DeletingDbTableConfig;

export const DeletingDbTable = Object.fromEntries(
  Object.keys(DeletingDbTableConfig).map((k) => [k, k]),
) as { [K in DeletingDbTable]: K };

export type DeletingDbTableConfigMap = {
  [K in keyof DeletingDbTableConfig]: {
    name: K;
    columns: ReadonlyArray<keyof z.infer<DeletingDbTableConfig[K]>>;
  };
}[keyof DeletingDbTableConfig];
