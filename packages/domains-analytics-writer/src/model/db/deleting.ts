import { z } from "zod";
import {
  agreementInReadmodelAgreement,
  attributeInReadmodelAttribute,
  purposeInReadmodelPurpose,
  eserviceInReadmodelCatalog,
  eserviceRiskAnalysisInReadmodelCatalog,
  tenantInReadmodelTenant,
  tenantMailInReadmodelTenant,
  eserviceDescriptorInterfaceInReadmodelCatalog,
} from "pagopa-interop-readmodel-models";

import { AttributeDeletingSchema } from "../attribute/attribute.js";
import { EserviceDeletingSchema } from "../catalog/eservice.js";
import { EserviceRiskAnalysisDeletingSchema } from "../catalog/eserviceRiskAnalysis.js";
import { TenantDeletingSchema } from "../tenant/tenant.js";
import { TenantMailDeletingSchema } from "../tenant/tenantMail.js";
import { AgreementDeletingSchema } from "../agreement/agreement.js";
import { PurposeDeletingSchema } from "../purpose/purpose.js";
import { EserviceDescriptorInterfaceDeletingSchema } from "../catalog/eserviceDescriptorInterface.js";

export const DeletingDbTableConfig = {
  attribute_deleting_table: AttributeDeletingSchema,
  catalog_deleting_table: EserviceDeletingSchema,
  catalog_risk_deleting_table: EserviceRiskAnalysisDeletingSchema,
  catalog_descriptor_interface_deleting_table:
    EserviceDescriptorInterfaceDeletingSchema,
  agreement_deleting_table: AgreementDeletingSchema,
  purpose_deleting_table: PurposeDeletingSchema,
  tenant_deleting_table: TenantDeletingSchema,
  tenant_mail_deleting_table: TenantMailDeletingSchema,
} as const;
export type DeletingDbTableConfig = typeof DeletingDbTableConfig;

export const DeletingDbTableReadModel = {
  attribute_deleting_table: attributeInReadmodelAttribute,
  catalog_deleting_table: eserviceInReadmodelCatalog,
  catalog_risk_deleting_table: eserviceRiskAnalysisInReadmodelCatalog,
  catalog_descriptor_interface_deleting_table:
    eserviceDescriptorInterfaceInReadmodelCatalog,
  agreement_deleting_table: agreementInReadmodelAgreement,
  purpose_deleting_table: purposeInReadmodelPurpose,
  tenant_deleting_table: tenantInReadmodelTenant,
  tenant_mail_deleting_table: tenantMailInReadmodelTenant,
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
