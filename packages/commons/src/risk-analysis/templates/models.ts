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

const Dependency = z.object({
  id: z.string(),
  value: z.string(),
});

const HideOptionConfig = z.object({
  id: z.string(),
  value: z.string(),
});

const ValidationOption = z.object({
  maxLength: z.number().optional(),
});

const LabeledValue = z.object({
  label: LocalizedText,
  value: z.string(),
});

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

const FormTemplateQuestion = z.discriminatedUnion("dataType", [
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
export type FormTemplateQuestion = z.infer<typeof FormTemplateQuestion>;

export const RiskAnalysisFormTemplate = z.object({
  version: z.string(),
  questions: z.array(FormTemplateQuestion),
});
export type RiskAnalysisFormTemplate = z.infer<typeof RiskAnalysisFormTemplate>;
