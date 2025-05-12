import { z } from "zod";
import {
  AttributeDeletingSchema,
  AttributeSchema,
} from "./attribute/attribute.js";
import { EserviceDeletingSchema, EserviceSchema } from "./catalog/eservice.js";
import { TenantDeletingSchema, TenantSchema } from "./tenant/tenant.js";
import {
  TenantFeatureDeletingSchema,
  TenantFeatureSchema,
} from "./tenant/tenantFeature.js";
import { TenantCertifiedAttributeSchema } from "./tenant/tenantCertifiedAttribute.js";
import { TenantDeclaredAttributeSchema } from "./tenant/tenantDeclaredAttribute.js";
import { TenantMailSchema } from "./tenant/tenantMail.js";
import { TenantVerifiedAttributeSchema } from "./tenant/tenantVerifiedAttribute.js";
import { TenantVerifiedAttributeRevokerSchema } from "./tenant/tenantVerifiedAttributeRevoker.js";
import { TenantVerifiedAttributeVerifierSchema } from "./tenant/tenantVerifiedAttributeVerifier.js";
import { EserviceDescriptorSchema } from "./catalog/eserviceDescriptor.js";
import { EserviceDescriptorAttributeSchema } from "./catalog/eserviceDescriptorAttribute.js";
import { EserviceDescriptorDocumentSchema } from "./catalog/eserviceDescriptorDocument.js";
import { EserviceDescriptorInterfaceSchema } from "./catalog/eserviceDescriptorInterface.js";
import { EserviceDescriptorRejectionReasonSchema } from "./catalog/eserviceDescriptorRejection.js";
import { EserviceDescriptorTemplateVersionRefSchema } from "./catalog/eserviceDescriptorTemplateVersionRef.js";
import { EserviceRiskAnalysisSchema } from "./catalog/eserviceRiskAnalysis.js";
import { EserviceRiskAnalysisAnswerSchema } from "./catalog/eserviceRiskAnalysisAnswer.js";

export const CatalogDbTableConfig = {
  eservice: EserviceSchema,
  eservice_descriptor: EserviceDescriptorSchema,
  eservice_descriptor_attribute: EserviceDescriptorAttributeSchema,
  eservice_descriptor_document: EserviceDescriptorDocumentSchema,
  eservice_descriptor_interface: EserviceDescriptorInterfaceSchema,
  eservice_descriptor_rejection_reason: EserviceDescriptorRejectionReasonSchema,
  eservice_descriptor_template_version_ref:
    EserviceDescriptorTemplateVersionRefSchema,
  eservice_risk_analysis: EserviceRiskAnalysisSchema,
  eservice_risk_analysis_answer: EserviceRiskAnalysisAnswerSchema,
} as const;
export type CatalogDbTableConfig = typeof CatalogDbTableConfig;

export const CatalogDbTable = Object.fromEntries(
  Object.keys(CatalogDbTableConfig).map((k) => [k, k])
) as { [K in keyof typeof CatalogDbTableConfig]: K };
export type CatalogDbTable = keyof typeof CatalogDbTableConfig;

export const AttributeDbTableConfig = {
  attribute: AttributeSchema,
} as const;
export type AttributeDbTableConfig = typeof AttributeDbTableConfig;

export const AttributeDbTable = Object.fromEntries(
  Object.keys(AttributeDbTableConfig).map((k) => [k, k])
) as { [K in keyof typeof AttributeDbTableConfig]: K };
export type AttributeDbTable = keyof typeof AttributeDbTable;

export const TenantDbTableConfig = {
  tenant: TenantSchema,
  tenant_mail: TenantMailSchema,
  tenant_certified_attribute: TenantCertifiedAttributeSchema,
  tenant_declared_attribute: TenantDeclaredAttributeSchema,
  tenant_verified_attribute: TenantVerifiedAttributeSchema,
  tenant_verified_attribute_verifier: TenantVerifiedAttributeVerifierSchema,
  tenant_verified_attribute_revoker: TenantVerifiedAttributeRevokerSchema,
  tenant_feature: TenantFeatureSchema,
} as const;
export type TenantDbTableConfig = typeof TenantDbTableConfig;

export const TenantDbTable = Object.fromEntries(
  Object.keys(TenantDbTableConfig).map((k) => [k, k])
) as { [K in keyof typeof TenantDbTableConfig]: K };
export type TenantDbTable = keyof typeof TenantDbTable;

export const DeletingDbTableConfig = {
  attribute_deleting_table: AttributeDeletingSchema,
  catalog_deleting_table: EserviceDeletingSchema,
  tenant_deleting_table: TenantDeletingSchema,
  tenant_feature_deleting_table: TenantFeatureDeletingSchema,
} as const;
export type DeletingDbTableConfig = typeof DeletingDbTableConfig;

export const DeletingDbTable = Object.fromEntries(
  Object.keys(DeletingDbTableConfig).map((k) => [k, k])
) as { [K in keyof typeof DeletingDbTableConfig]: K };
export type DeletingDbTable = keyof typeof DeletingDbTable;

export type DeletingTableConfigMap = {
  [K in keyof typeof DeletingDbTableConfig]: {
    name: K;
    columns: ReadonlyArray<keyof z.infer<(typeof DeletingDbTableConfig)[K]>>;
  };
}[keyof typeof DeletingDbTableConfig];

export const DbTables = {
  ...TenantDbTableConfig,
  ...AttributeDbTableConfig,
  ...CatalogDbTableConfig,
} as const;
export type DbTableSchemas = typeof DbTables;
export type DbTableNames = keyof DbTableSchemas;
