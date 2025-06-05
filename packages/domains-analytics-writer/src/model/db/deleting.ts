import { z } from "zod";
import {
  agreementInReadmodelAgreement,
  attributeInReadmodelAttribute,
  eserviceInReadmodelCatalog,
  eserviceRiskAnalysisInReadmodelCatalog,
  eserviceTemplateInReadmodelEserviceTemplate,
  purposeInReadmodelPurpose,
  tenantFeatureInReadmodelTenant,
  tenantInReadmodelTenant,
  tenantMailInReadmodelTenant,
  clientInReadmodelClient,
  clientUserInReadmodelClient,
  clientPurposeInReadmodelClient,
  clientKeyInReadmodelClient,
} from "pagopa-interop-readmodel-models";

import { AttributeDeletingSchema } from "../attribute/attribute.js";
import { EserviceDeletingSchema } from "../catalog/eservice.js";
import { EserviceRiskAnalysisDeletingSchema } from "../catalog/eserviceRiskAnalysis.js";
import { EserviceTemplateDeletingSchema } from "../eserviceTemplate/eserviceTemplate.js";
import { TenantDeletingSchema } from "../tenant/tenant.js";
import { TenantMailDeletingSchema } from "../tenant/tenantMail.js";
import { TenantFeatureDeletingSchema } from "../tenant/tenantFeature.js";
import { AgreementDeletingSchema } from "../agreement/agreement.js";
import { ClientDeletingSchema } from "../authorization/client.js";
import { ClientUserDeletingSchema } from "../authorization/clientUser.js";
import { ClientPurposeDeletingSchema } from "../authorization/clientPurpose.js";
import { ClientKeyDeletingSchema } from "../authorization/clientKey.js";
import { PurposeDeletingSchema } from "../purpose/purpose.js";

export const DeletingDbTableConfig = {
  attribute_deleting_table: AttributeDeletingSchema,
  catalog_deleting_table: EserviceDeletingSchema,
  catalog_risk_deleting_table: EserviceRiskAnalysisDeletingSchema,
  agreement_deleting_table: AgreementDeletingSchema,
  purpose_deleting_table: PurposeDeletingSchema,
  tenant_deleting_table: TenantDeletingSchema,
  tenant_mail_deleting_table: TenantMailDeletingSchema,
  tenant_feature_deleting_table: TenantFeatureDeletingSchema,
  client_deleting_table: ClientDeletingSchema,
  client_user_deleting_table: ClientUserDeletingSchema,
  client_purpose_deleting_table: ClientPurposeDeletingSchema,
  client_key_deleting_table: ClientKeyDeletingSchema,
  eservice_template_deleting_table: EserviceTemplateDeletingSchema,
} as const;
export type DeletingDbTableConfig = typeof DeletingDbTableConfig;

export const DeletingDbTableReadModel = {
  attribute_deleting_table: attributeInReadmodelAttribute,
  catalog_deleting_table: eserviceInReadmodelCatalog,
  catalog_risk_deleting_table: eserviceRiskAnalysisInReadmodelCatalog,
  agreement_deleting_table: agreementInReadmodelAgreement,
  purpose_deleting_table: purposeInReadmodelPurpose,
  tenant_deleting_table: tenantInReadmodelTenant,
  tenant_mail_deleting_table: tenantMailInReadmodelTenant,
  tenant_feature_deleting_table: tenantFeatureInReadmodelTenant,
  client_deleting_table: clientInReadmodelClient,
  client_user_deleting_table: clientUserInReadmodelClient,
  client_purpose_deleting_table: clientPurposeInReadmodelClient,
  client_key_deleting_table: clientKeyInReadmodelClient,
  eservice_template_deleting_table: eserviceTemplateInReadmodelEserviceTemplate,
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
