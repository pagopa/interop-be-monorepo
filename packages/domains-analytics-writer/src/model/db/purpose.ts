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

export type PurposeDbTable = keyof PurposeDbTableConfig;

export const PurposeDbTable = Object.fromEntries(
  Object.keys(PurposeDbTableConfig).map((k) => [k, k])
) as { [K in PurposeDbTable]: K };
