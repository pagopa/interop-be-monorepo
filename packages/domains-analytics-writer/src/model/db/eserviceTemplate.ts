import {
  eserviceTemplateInReadmodelEserviceTemplate,
  eserviceTemplateVersionInReadmodelEserviceTemplate,
  eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate,
  eserviceTemplateVersionDocumentInReadmodelEserviceTemplate,
  eserviceTemplateVersionAttributeInReadmodelEserviceTemplate,
  eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate,
  eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate,
} from "pagopa-interop-readmodel-models";
import { EserviceTemplateSchema } from "../eserviceTemplate/eserviceTemplate.js";
import { EserviceTemplateRiskAnalysisSchema } from "../eserviceTemplate/eserviceTemplateRiskAnalysis.js";
import { EserviceTemplateRiskAnalysisAnswerSchema } from "../eserviceTemplate/eserviceTemplateRiskAnalysisAnswer.js";
import { EserviceTemplateVersionSchema } from "../eserviceTemplate/eserviceTemplateVersion.js";
import { EserviceTemplateVersionAttributeSchema } from "../eserviceTemplate/eserviceTemplateVersionAttribute.js";
import { EserviceTemplateVersionDocumentSchema } from "../eserviceTemplate/eserviceTemplateVersionDocument.js";
import { EserviceTemplateVersionInterfaceSchema } from "../eserviceTemplate/eserviceTemplateVersionInterface.js";

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

export const EserviceTemplateDbTableReadModel = {
  eservice_template: eserviceTemplateInReadmodelEserviceTemplate,
  eservice_template_version: eserviceTemplateVersionInReadmodelEserviceTemplate,
  eservice_template_version_interface:
    eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate,
  eservice_template_version_document:
    eserviceTemplateVersionDocumentInReadmodelEserviceTemplate,
  eservice_template_version_attribute:
    eserviceTemplateVersionAttributeInReadmodelEserviceTemplate,
  eservice_template_risk_analysis:
    eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate,
  eservice_template_risk_analysis_answer:
    eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate,
} as const;
export type EserviceTemplateDbTableReadModel =
  typeof EserviceTemplateDbTableReadModel;

export type EserviceTemplateDbTable =
  keyof typeof EserviceTemplateDbTableConfig;

export const EserviceTemplateDbTable = Object.fromEntries(
  Object.keys(EserviceTemplateDbTableConfig).map((k) => [k, k])
) as { [K in EserviceTemplateDbTable]: K };
