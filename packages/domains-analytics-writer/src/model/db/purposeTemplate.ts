import {
  PurposeTemplateSchema,
  PurposeTemplateRiskAnalysisFormSchema,
  PurposeTemplateRiskAnalysisAnswerSchema,
  PurposeTemplateRiskAnalysisAnswerAnnotationSchema,
  PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSchema,
  PurposeTemplateEServiceDescriptorSchema,
} from "pagopa-interop-kpi-models";

export const PurposeTemplateDbTableConfig = {
  purpose_template: PurposeTemplateSchema,
  purpose_template_eservice_descriptor: PurposeTemplateEServiceDescriptorSchema,
  purpose_template_risk_analysis_form: PurposeTemplateRiskAnalysisFormSchema,
  purpose_template_risk_analysis_answer:
    PurposeTemplateRiskAnalysisAnswerSchema,
  purpose_template_risk_analysis_answer_annotation:
    PurposeTemplateRiskAnalysisAnswerAnnotationSchema,
  purpose_template_risk_analysis_answer_annotation_document:
    PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSchema,
} as const;
export type PurposeTemplateDbTableConfig = typeof PurposeTemplateDbTableConfig;

export type PurposeTemplateDbTable = keyof typeof PurposeTemplateDbTableConfig;

export const PurposeTemplateDbTable = Object.fromEntries(
  Object.keys(PurposeTemplateDbTableConfig).map((k) => [k, k])
) as { [K in PurposeTemplateDbTable]: K };
