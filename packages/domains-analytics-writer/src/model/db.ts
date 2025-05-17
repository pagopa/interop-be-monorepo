import { z } from "zod";
import {
  AttributeDeletingSchema,
  AttributeSchema,
} from "./attribute/attribute.js";
import { EserviceDeletingSchema, EserviceSchema } from "./catalog/eservice.js";
import { EserviceDescriptorSchema } from "./catalog/eserviceDescriptor.js";
import { EserviceDescriptorAttributeSchema } from "./catalog/eserviceDescriptorAttribute.js";
import { EserviceDescriptorDocumentSchema } from "./catalog/eserviceDescriptorDocument.js";
import { EserviceDescriptorInterfaceSchema } from "./catalog/eserviceDescriptorInterface.js";
import { EserviceDescriptorRejectionReasonSchema } from "./catalog/eserviceDescriptorRejection.js";
import { EserviceDescriptorTemplateVersionRefSchema } from "./catalog/eserviceDescriptorTemplateVersionRef.js";
import {
  EserviceRiskAnalysisDeletingSchema,
  EserviceRiskAnalysisSchema,
} from "./catalog/eserviceRiskAnalysis.js";
import { EserviceRiskAnalysisAnswerSchema } from "./catalog/eserviceRiskAnalysisAnswer.js";
import {
  AgreementDeletingSchema,
  AgreementSchema,
} from "./agreement/agreement.js";
import { AgreementConsumerDocumentSchema } from "./agreement/agreementConsumerDocument.js";
import { AgreementStampSchema } from "./agreement/agreementStamp.js";
import { AgreementContractSchema } from "./agreement/agreementContract.js";
import { AgreementAttributeSchema } from "./agreement/agreementAttribute.js";

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

export const AgreementDbTableConfig = {
  agreement: AgreementSchema,
  agreement_stamp: AgreementStampSchema,
  agreement_attribute: AgreementAttributeSchema,
  agreement_consumer_document: AgreementConsumerDocumentSchema,
  agreement_contract: AgreementContractSchema,
} as const;

export type AgreementDbTableConfig = typeof AttributeDbTableConfig;

export const AgreementDbTable = Object.fromEntries(
  Object.keys(AgreementDbTableConfig).map((k) => [k, k])
) as { [K in keyof typeof AgreementDbTableConfig]: K };
export type AgreementDbTable = keyof typeof AgreementDbTable;

export const DeletingDbTableConfig = {
  attribute_deleting_table: AttributeDeletingSchema,
  catalog_deleting_table: EserviceDeletingSchema,
  catalog_risk_deleting_table: EserviceRiskAnalysisDeletingSchema,
  agreement_deleting_table: AgreementDeletingSchema,
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
  ...AttributeDbTableConfig,
  ...CatalogDbTableConfig,
  ...AgreementDbTableConfig,
} as const;

export type DbTableSchemas = typeof DbTables;
export type DbTableNames = keyof DbTableSchemas;
