import { TenantKind } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { z } from "zod";
import pa1 from "./templates/PA/1.0.json";
import pa2 from "./templates/PA/2.0.json";
import pa3 from "./templates/PA/3.0.json";
import private1 from "./templates/PRIVATE/1.0.json";
import private2 from "./templates/PRIVATE/2.0.json";

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

const RiskAnalysisFormTemplate = z.object({
  version: z.string(),
  questions: z.array(FormTemplateQuestion),
});
export type RiskAnalysisFormTemplate = z.infer<typeof RiskAnalysisFormTemplate>;

type Template = "pa1" | "pa2" | "pa3" | "private1" | "private2";

export function getTemplate(template: Template): RiskAnalysisFormTemplate {
  return RiskAnalysisFormTemplate.parse(
    match(template)
      .with("pa1", () => pa1)
      .with("pa2", () => pa2)
      .with("pa3", () => pa3)
      .with("private1", () => private1)
      .with("private2", () => private2)
      .exhaustive()
  );
}

export const riskAnalysisTemplates: Record<
  TenantKind,
  RiskAnalysisFormTemplate[]
> = {
  PA: [getTemplate("pa1"), getTemplate("pa2"), getTemplate("pa3")],
  PRIVATE: [getTemplate("private1"), getTemplate("private2")],
  GSP: [getTemplate("private1"), getTemplate("private2")],
};
