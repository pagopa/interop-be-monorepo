import { z } from "zod";
import {
  PurposeId,
  RiskAnalysisFormId,
  RiskAnalysisId,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisSingleAnswerId,
} from "../brandedIds.js";

export const RiskAnalysisSingleAnswer = z.object({
  id: RiskAnalysisSingleAnswerId,
  key: z.string(),
  value: z.string().optional(),
});
export type RiskAnalysisSingleAnswer = z.infer<typeof RiskAnalysisSingleAnswer>;

export const RiskAnalysisMultiAnswer = z.object({
  id: RiskAnalysisMultiAnswerId,
  key: z.string(),
  values: z.array(z.string()),
});
export type RiskAnalysisMultiAnswer = z.infer<typeof RiskAnalysisMultiAnswer>;

export const RiskAnalysisForm = z.object({
  id: RiskAnalysisFormId,
  version: z.string(),
  singleAnswers: z.array(RiskAnalysisSingleAnswer),
  multiAnswers: z.array(RiskAnalysisMultiAnswer),
});
export type RiskAnalysisForm = z.infer<typeof RiskAnalysisForm>;

export const PurposeRiskAnalysisForm = RiskAnalysisForm.and(
  z.object({
    riskAnalysisId: RiskAnalysisId.optional(),
  })
);

export type PurposeRiskAnalysisForm = z.infer<typeof PurposeRiskAnalysisForm>;

export const RiskAnalysis = z.object({
  id: RiskAnalysisId,
  name: z.string(),
  riskAnalysisForm: RiskAnalysisForm,
  createdAt: z.coerce.date(),
});
export type RiskAnalysis = z.infer<typeof RiskAnalysis>;

export const PurposeRiskAnalysisFormSQL = z.object({
  id: RiskAnalysisFormId,
  purpose_id: PurposeId,
  metadata_version: z.number(),
  version: z.string(),
});
export type PurposeRiskAnalysisFormSQL = z.infer<
  typeof PurposeRiskAnalysisFormSQL
>;

export const purposeRiskAnalysisAnswerKind = {
  single: "single",
  multi: "multi",
} as const;
export const PurposeRiskAnalysisAnswerKind = z.enum([
  Object.values(purposeRiskAnalysisAnswerKind)[0],
  ...Object.values(purposeRiskAnalysisAnswerKind).slice(1),
]);
export type PurposeRiskAnalysisAnswerKind = z.infer<
  typeof PurposeRiskAnalysisAnswerKind
>;

export const PurposeRiskAnalysisAnswerSQL = z.object({
  id: RiskAnalysisSingleAnswerId || RiskAnalysisMultiAnswerId,
  purpose_id: PurposeId,
  metadata_version: z.number(),
  risk_analysis_form_id: RiskAnalysisFormId,
  kind: PurposeRiskAnalysisAnswerKind,
  key: z.string(),
  value: z.array(z.string()).optional(),
});
export type PurposeRiskAnalysisAnswerSQL = z.infer<
  typeof PurposeRiskAnalysisAnswerSQL
>;
