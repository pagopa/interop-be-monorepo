import { TenantKind } from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { z } from "zod";
import pa1 from "./templates/PA/1.0.json";
import pa2 from "./templates/PA/2.0.json";
import pa3 from "./templates/PA/3.0.json";
import private1 from "./templates/PRIVATE/1.0.json";
import private2 from "./templates/PRIVATE/2.0.json";

export const dataType = {
  freeText: "FreeText",
  single: "Single",
  multi: "Multi",
} as const;
export const DataType = z.enum([
  Object.values(dataType)[0],
  ...Object.values(dataType).slice(1),
]);
export type DataType = z.infer<typeof DataType>;

type LocalizedText = {
  it: string;
  en: string;
};

type Dependency = {
  id: string;
  value: string;
};

type HideOptionConfig = {
  id: string;
  value: string;
};

type ValidationOption = {
  maxLength?: number;
};

type LabeledValue = {
  label: LocalizedText;
  value: string;
};

type FormConfigQuestionCommonProps = {
  id: string;
  label: LocalizedText;
  infoLabel?: LocalizedText;
  required: boolean;
  dependencies: Dependency[];
  type: string;
  defaultValue: string[];
  hideOption?: Record<string, HideOptionConfig[]>;
  validation?: ValidationOption;
};

type FreeInputQuestion = FormConfigQuestionCommonProps & {
  dataType: "FreeText";
};

type SingleQuestion = FormConfigQuestionCommonProps & {
  dataType: "Single";
  options: LabeledValue[];
};

type MultiQuestion = FormConfigQuestionCommonProps & {
  dataType: "Multi";
  options: LabeledValue[];
};

export type FormTemplateQuestion =
  | FreeInputQuestion
  | SingleQuestion
  | MultiQuestion;

export type RiskAnalysisFormTemplate = {
  version: string;
  questions: FormTemplateQuestion[];
};

type Template = "pa1" | "pa2" | "pa3" | "private1" | "private2";

export function getTemplate(template: Template): RiskAnalysisFormTemplate {
  const loadedTemplate = match(template)
    .with("pa1", () => pa1)
    .with("pa2", () => pa2)
    .with("pa3", () => pa3)
    .with("private1", () => private1)
    .with("private2", () => private2)
    .exhaustive();

  // TODO consider parsing the template with zod instead
  return {
    version: loadedTemplate.version,
    questions: loadedTemplate.questions.map((question) =>
      match(question)
        .with({ dataType: dataType.freeText, options: P.nullish }, (q) => q)
        .with(
          { dataType: dataType.single, options: P.not(P.nullish) },
          (q) => q
        )
        .with({ dataType: dataType.multi, options: P.not(P.nullish) }, (q) => q)
        .otherwise(() => {
          // TODO Better error
          throw new Error(
            `Cannot load template: invalid question type or options - question id: ${question.id} - question type: ${question.dataType} - options: ${question.options}`
          );
        })
    ),
  };
}

export const riskAnalysisTemplates: Record<
  TenantKind,
  RiskAnalysisFormTemplate[]
> = {
  PA: [getTemplate("pa1"), getTemplate("pa2"), getTemplate("pa3")],
  PRIVATE: [getTemplate("private1"), getTemplate("private2")],
  GSP: [getTemplate("private1"), getTemplate("private2")],
};
