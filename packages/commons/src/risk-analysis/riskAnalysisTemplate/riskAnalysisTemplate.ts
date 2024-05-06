import { z } from "zod";

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
  dataType: z.literal(dataType.freetext),
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
  dataType: z.literal(dataType.single),
  options: z.array(LabeledValue),
});
export type SingleQuestion = z.infer<typeof SingleQuestion>;

export const MultiQuestion = SingleQuestion.extend({
  dataType: z.literal(dataType.multi),
});
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
