import { z } from "zod";

export const dataType = {
  freeText: "freeText",
  single: "single",
  multi: "multi",
} as const;
export const DataType = z.enum([
  Object.values(dataType)[0],
  ...Object.values(dataType).slice(1),
]);
export type DataType = z.infer<typeof DataType>;

const LocalizedText = z.object({
  it: z.string(),
  en: z.string(),
});
export type LocalizedText = z.infer<typeof LocalizedText>;

const Dependency = z.object({
  id: z.string(),
  value: z.string(),
});
export type Dependency = z.infer<typeof Dependency>;

const HideOptionConfig = z.object({
  id: z.string(),
  value: z.string(),
});
export type HideOptionConfig = z.infer<typeof HideOptionConfig>;

const ValidationOption = z.object({
  maxLength: z.number().optional(),
});
export type ValidationOption = z.infer<typeof ValidationOption>;

const LabeledValue = z.object({
  label: LocalizedText,
  value: z.string(),
});
export type LabeledValue = z.infer<typeof LabeledValue>;

const FormConfigQuestionCommonProps = z.object({
  id: z.string(),
  label: LocalizedText,
  infoLabel: LocalizedText.optional(),
  required: z.boolean(),
  dependencies: z.array(Dependency),
  type: z.string(),
  defaultValue: z.array(z.string()),
  hideOption: z.record(z.array(HideOptionConfig)).optional(),
  validation: ValidationOption.optional(),
});

const FormQuestionRules = z.discriminatedUnion("dataType", [
  FormConfigQuestionCommonProps.merge(
    z.object({
      dataType: z.literal(dataType.freeText),
    })
  ),
  FormConfigQuestionCommonProps.merge(
    z.object({
      dataType: z.literal(dataType.single),
      options: z.array(LabeledValue),
    })
  ),
  FormConfigQuestionCommonProps.merge(
    z.object({
      dataType: z.literal(dataType.multi),
      options: z.array(LabeledValue),
    })
  ),
]);
export type FormQuestionRules = z.infer<typeof FormQuestionRules>;

export const RiskAnalysisFormRules = z.object({
  version: z.string(),
  expiration: z.date().optional(),
  questions: z.array(FormQuestionRules),
});
export type RiskAnalysisFormRules = z.infer<typeof RiskAnalysisFormRules>;
