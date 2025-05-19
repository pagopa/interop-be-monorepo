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
import { extractProp } from "../../db/dbModelMetadataExtractor.js";

const PurposeTableMeta = {
  purpose: {
    schema: PurposeSchema,
    readModel: purposeInReadmodelPurpose,
  },
  purpose_risk_analysis_form: {
    schema: PurposeRiskAnalysisFormSchema,
    readModel: purposeRiskAnalysisFormInReadmodelPurpose,
  },
  purpose_risk_analysis_answer: {
    schema: PurposeRiskAnalysisAnswerSchema,
    readModel: purposeRiskAnalysisAnswerInReadmodelPurpose,
  },
  purpose_version: {
    schema: PurposeVersionSchema,
    readModel: purposeVersionInReadmodelPurpose,
  },
  purpose_version_document: {
    schema: PurposeVersionDocumentSchema,
    readModel: purposeVersionDocumentInReadmodelPurpose,
  },
} as const;

export const PurposeDbTableConfig = extractProp(PurposeTableMeta, "schema");
export type PurposeDbTableConfig = typeof PurposeDbTableConfig;
export const PurposeDbTableReadModel = extractProp(
  PurposeTableMeta,
  "readModel",
);
export type PurposeDbTableReadModel = typeof PurposeDbTableReadModel;
export type PurposeDbTable = keyof typeof PurposeDbTableConfig;
export const PurposeDbTable = Object.fromEntries(
  Object.keys(PurposeDbTableConfig).map((k) => [k, k]),
) as { [K in PurposeDbTable]: K };
