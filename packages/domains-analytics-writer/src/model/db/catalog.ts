import { eserviceDescriptorInReadmodelCatalog } from "pagopa-interop-readmodel-models";
import {
  EserviceSchema,
  EserviceDescriptorSchema,
  EserviceDescriptorAttributeSchema,
  EserviceDescriptorDocumentSchema,
  EserviceDescriptorInterfaceSchema,
  EserviceDescriptorRejectionReasonSchema,
  EserviceDescriptorTemplateVersionRefSchema,
  EserviceRiskAnalysisSchema,
  EserviceRiskAnalysisAnswerSchema,
} from "pagopa-interop-kpi-models";

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

export const CatalogDbPartialTableConfig = {
  descriptor_server_urls: EserviceDescriptorSchema,
} as const;
export type CatalogDbPartialTableConfig = typeof CatalogDbPartialTableConfig;

export const CatalogDbPartialTableReadModel = {
  descriptor_server_urls: eserviceDescriptorInReadmodelCatalog,
} as const;

export type CatalogDbPartialTableReadModel =
  typeof CatalogDbPartialTableReadModel;

export type CatalogDbPartialTable = keyof typeof CatalogDbPartialTableReadModel;
export const CatalogDbPartialTable = Object.fromEntries(
  Object.keys(CatalogDbPartialTableConfig).map((k) => [k, k])
) as { [K in CatalogDbPartialTable]: K };

export type CatalogDbTable = keyof typeof CatalogDbTableConfig;

export const CatalogDbTable = Object.fromEntries(
  Object.keys(CatalogDbTableConfig).map((k) => [k, k])
) as { [K in CatalogDbTable]: K };
