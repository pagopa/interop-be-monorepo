import { z } from "zod";
import { AttributeDeletingSchema } from "./attribute/attribute.js";
import { EserviceDeletingSchema } from "./catalog/eservice.js";
import { EserviceRiskAnalysisDeletingSchema } from "./catalog/eserviceRiskAnalysis.js";
import { AgreementDeletingSchema } from "./agreement/agreement.js";

export const CatalogDbTable = {
  eservice: "eservice",
  eservice_descriptor: "eservice_descriptor",
  eservice_descriptor_attribute: "eservice_descriptor_attribute",
  eservice_descriptor_document: "eservice_descriptor_document",
  eservice_descriptor_interface: "eservice_descriptor_interface",
  eservice_descriptor_rejection_reason: "eservice_descriptor_rejection_reason",
  eservice_descriptor_template_version_ref:
    "eservice_descriptor_template_version_ref",
  eservice_risk_analysis: "eservice_risk_analysis",
  eservice_risk_analysis_answer: "eservice_risk_analysis_answer",
} as const;

export type CatalogDbTable =
  (typeof CatalogDbTable)[keyof typeof CatalogDbTable];
export const AttributeDbTable = {
  attribute: "attribute",
} as const;

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

export const AgreementDbTable = {
  agreement: "agreement",
  agreement_stamp: "agreement_stamp",
  agreement_attribute: "agreement_attribute",
  agreement_consumer_document: "agreement_consumer_document",
  agreement_contract: "agreement_contract",
} as const;

export type AgreementDbTable =
  (typeof AgreementDbTable)[keyof typeof AgreementDbTable];

export type AttributeDbtable =
  (typeof AttributeDbTable)[keyof typeof AttributeDbTable];
