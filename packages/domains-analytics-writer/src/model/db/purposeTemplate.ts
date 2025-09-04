import {
  purposeTemplateInReadmodelPurposeTemplate,
  purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate,
  purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate,
  purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate,
  purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate,
  purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate,
} from "pagopa-interop-readmodel-models";

import { PurposeTemplateSchema } from "../purposeTemplate/purposeTemplate.js";
import { PurposeTemplateRiskAnalysisFormSchema } from "../purposeTemplate/purposeTemplateRiskAnalysisForm.js";
import { PurposeTemplateRiskAnalysisAnswerSchema } from "../purposeTemplate/purposeTemplateRiskAnalysisAnswer.js";
import { PurposeTemplateRiskAnalysisAnswerAnnotationSchema } from "../purposeTemplate/purposeTemplateRiskAnalysisAnswerAnnotation.js";
import { PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSchema } from "../purposeTemplate/purposeTemplateRiskAnalysisAnswerAnnotationDocument.js";
import { PurposeTemplateEServiceDescriptorSchema } from "../purposeTemplate/purposeTemplateEserviceDescriptor.js";

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

export const PurposeTemplateDbTableReadModel = {
  purpose_template: purposeTemplateInReadmodelPurposeTemplate,
  purpose_template_eservice_descriptor:
    purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate,
  purpose_template_risk_analysis_form:
    purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate,
  purpose_template_risk_analysis_answer:
    purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate,
  purpose_template_risk_analysis_answer_annotation:
    purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate,
  purpose_template_risk_analysis_answer_annotation_document:
    purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate,
} as const;
export type PurposeTemplateDbTableReadModel =
  typeof PurposeTemplateDbTableReadModel;

export type PurposeTemplateDbTable = keyof typeof PurposeTemplateDbTableConfig;

export const PurposeTemplateDbTable = Object.fromEntries(
  Object.keys(PurposeTemplateDbTableConfig).map((k) => [k, k])
) as { [K in PurposeTemplateDbTable]: K };
