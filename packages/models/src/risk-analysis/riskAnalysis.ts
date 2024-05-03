import { z } from "zod";
import {
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

export const LocalizedText = z.object({
  it: z.string(),
  en: z.string(),
});
export type LocalizedText = z.infer<typeof LocalizedText>;

export const dataType = {
  single: "SINGLE",
  multi: "MULTI",
  freetext: "FREETEXT",
} as const;
export const DataType = z.enum([
  Object.values(dataType)[0],
  ...Object.values(dataType).slice(1),
]);
export type DataType = z.infer<typeof DataType>;

export const Dependency = z.object({
  id: z.string(),
  value: z.string(),
});
export type Dependency = z.infer<typeof Dependency>;

export const HideOptionConfig = z.object({
  id: z.string(),
  value: z.string(),
});
export type HideOptionConfig = z.infer<typeof HideOptionConfig>;

export const ValidationOption = z.object({
  maxLength: z.number().optional(),
});
export type ValidationOption = z.infer<typeof ValidationOption>;

export const FreeInputQuestion = z.object({
  id: z.string(),
  label: LocalizedText,
  infoLabel: LocalizedText.optional(),
  dataType: DataType,
  required: z.boolean(),
  dependencies: z.array(Dependency),
  type: z.string(),
  defaultValue: z.array(z.string()),
  hideOption: z.record(z.string(), z.array(HideOptionConfig)).optional(),
  validation: ValidationOption.optional(),
});
export type FreeInputQuestion = z.infer<typeof FreeInputQuestion>;

export const LabeledValue = z.object({
  label: LocalizedText,
  value: z.string(),
});
export type LabeledValue = z.infer<typeof LabeledValue>;

export const SingleQuestion = FreeInputQuestion.extend({
  options: z.array(LabeledValue),
});
export type SingleQuestion = z.infer<typeof SingleQuestion>;

export const MultiQuestion = SingleQuestion;
export type MultiQuestion = z.infer<typeof MultiQuestion>;

export const FormConfigQuestion = z.discriminatedUnion("dataType", [
  FreeInputQuestion,
  SingleQuestion,
  MultiQuestion,
]);
export type FormConfigQuestion = z.infer<typeof FormConfigQuestion>;

export const RiskAnalysisFormConfig = z.object({
  version: z.string(),
  questions: z.array(FormConfigQuestion),
});
export type RiskAnalysisFormConfig = z.infer<typeof RiskAnalysisFormConfig>;
