import {
  EserviceTemplateSchema,
  EserviceTemplateVersionSchema,
  EserviceTemplateVersionInterfaceSchema,
  EserviceTemplateVersionDocumentSchema,
  EserviceTemplateVersionAttributeSchema,
  EserviceTemplateRiskAnalysisSchema,
  EserviceTemplateRiskAnalysisAnswerSchema,
} from "pagopa-interop-kpi-models";

export const EserviceTemplateDbTableConfig = {
  eservice_template: EserviceTemplateSchema,
  eservice_template_version: EserviceTemplateVersionSchema,
  eservice_template_version_interface: EserviceTemplateVersionInterfaceSchema,
  eservice_template_version_document: EserviceTemplateVersionDocumentSchema,
  eservice_template_version_attribute: EserviceTemplateVersionAttributeSchema,
  eservice_template_risk_analysis: EserviceTemplateRiskAnalysisSchema,
  eservice_template_risk_analysis_answer:
    EserviceTemplateRiskAnalysisAnswerSchema,
} as const;
export type EserviceTemplateDbTableConfig =
  typeof EserviceTemplateDbTableConfig;

export type EserviceTemplateDbTable =
  keyof typeof EserviceTemplateDbTableConfig;

export const EserviceTemplateDbTable = Object.fromEntries(
  Object.keys(EserviceTemplateDbTableConfig).map((k) => [k, k])
) as { [K in EserviceTemplateDbTable]: K };
