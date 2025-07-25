import {
  purposeInReadmodelPurpose,
  purposeRiskAnalysisAnswerInReadmodelPurpose,
  purposeRiskAnalysisFormInReadmodelPurpose,
  purposeVersionDocumentInReadmodelPurpose,
  purposeVersionInReadmodelPurpose,
} from "pagopa-interop-readmodel-models";
import { PurposeSchema } from "../purpose/purpose.js";
import { PurposeRiskAnalysisFormSchema } from "../purpose/purposeRiskAnalysis.js";
import { PurposeRiskAnalysisAnswerSchema } from "../purpose/purposeRiskAnalysisAnswer.js";
import { PurposeVersionSchema } from "../purpose/purposeVersion.js";
import { PurposeVersionDocumentSchema } from "../purpose/purposeVersionDocument.js";

export const PurposeDbTableConfig = {
  purpose: PurposeSchema,
  purpose_risk_analysis_form: PurposeRiskAnalysisFormSchema,
  purpose_risk_analysis_answer: PurposeRiskAnalysisAnswerSchema,
  purpose_version: PurposeVersionSchema,
  purpose_version_document: PurposeVersionDocumentSchema,
} as const;

export type PurposeDbTableConfig = typeof PurposeDbTableConfig;

export const PurposeDbTableReadModel = {
  purpose: purposeInReadmodelPurpose,
  purpose_risk_analysis_form: purposeRiskAnalysisFormInReadmodelPurpose,
  purpose_risk_analysis_answer: purposeRiskAnalysisAnswerInReadmodelPurpose,
  purpose_version: purposeVersionInReadmodelPurpose,
  purpose_version_document: purposeVersionDocumentInReadmodelPurpose,
} as const;

export type PurposeDbTableReadModel = typeof PurposeDbTableReadModel;

export type PurposeDbTable = keyof PurposeDbTableConfig;

export const PurposeDbTable = Object.fromEntries(
  Object.keys(PurposeDbTableConfig).map((k) => [k, k])
) as { [K in PurposeDbTable]: K };
