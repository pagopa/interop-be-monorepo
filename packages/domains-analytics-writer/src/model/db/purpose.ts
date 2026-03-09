import {
  purposeInReadmodelPurpose,
  purposeRiskAnalysisAnswerInReadmodelPurpose,
  purposeRiskAnalysisFormInReadmodelPurpose,
  purposeVersionDocumentInReadmodelPurpose,
  purposeVersionInReadmodelPurpose,
  purposeVersionSignedDocumentInReadmodelPurpose,
  purposeVersionStampInReadmodelPurpose,
} from "pagopa-interop-readmodel-models";
import {
  PurposeSchema,
  PurposeRiskAnalysisFormSchema,
  PurposeRiskAnalysisAnswerSchema,
  PurposeVersionSchema,
  PurposeVersionDocumentSchema,
  PurposeVersionStampSchema,
  PurposeVersionSignedDocumentSchema,
} from "pagopa-interop-kpi-models";

export const PurposeDbTableConfig = {
  purpose: PurposeSchema,
  purpose_risk_analysis_form: PurposeRiskAnalysisFormSchema,
  purpose_risk_analysis_answer: PurposeRiskAnalysisAnswerSchema,
  purpose_version: PurposeVersionSchema,
  purpose_version_document: PurposeVersionDocumentSchema,
  purpose_version_stamp: PurposeVersionStampSchema,
  purpose_version_signed_document: PurposeVersionSignedDocumentSchema,
} as const;

export type PurposeDbTableConfig = typeof PurposeDbTableConfig;

export const PurposeDbTableReadModel = {
  purpose: purposeInReadmodelPurpose,
  purpose_risk_analysis_form: purposeRiskAnalysisFormInReadmodelPurpose,
  purpose_risk_analysis_answer: purposeRiskAnalysisAnswerInReadmodelPurpose,
  purpose_version: purposeVersionInReadmodelPurpose,
  purpose_version_document: purposeVersionDocumentInReadmodelPurpose,
  purpose_version_stamp: purposeVersionStampInReadmodelPurpose,
  purpose_version_signed_document:
    purposeVersionSignedDocumentInReadmodelPurpose,
} as const;

export type PurposeDbTableReadModel = typeof PurposeDbTableReadModel;

export type PurposeDbTable = keyof PurposeDbTableConfig;

export const PurposeDbTable = Object.fromEntries(
  Object.keys(PurposeDbTableConfig).map((k) => [k, k])
) as { [K in PurposeDbTable]: K };
