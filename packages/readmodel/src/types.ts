import { InferSelectModel } from "drizzle-orm";
import {
  purposeInReadmodel,
  purposeRiskAnalysisAnswerInReadmodel,
  purposeRiskAnalysisFormInReadmodel,
  purposeVersionDocumentInReadmodel,
  purposeVersionInReadmodel,
} from "./drizzle/schema.js";

export type PurposeSQL = InferSelectModel<typeof purposeInReadmodel>;
export type PurposeVersionSQL = InferSelectModel<
  typeof purposeVersionInReadmodel
>;
export type PurposeVersionDocumentSQL = InferSelectModel<
  typeof purposeVersionDocumentInReadmodel
>;
export type PurposeRiskAnalysisFormSQL = InferSelectModel<
  typeof purposeRiskAnalysisFormInReadmodel
>;
export type PurposeRiskAnalysisAnswerSQL = InferSelectModel<
  typeof purposeRiskAnalysisAnswerInReadmodel
>;
