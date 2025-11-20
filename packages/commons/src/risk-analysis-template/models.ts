import { RiskAnalysisFormTemplate } from "pagopa-interop-models";

export type RiskAnalysisFormTemplateToValidate = {
  version: string;
  answers: Record<string, string[]>;
};

export function riskAnalysisFormTemplateToRiskAnalysisFormTemplateToValidate(
  form: RiskAnalysisFormTemplate
): RiskAnalysisFormTemplateToValidate {
  return {
    version: form.version,
    answers: {
      ...form.singleAnswers.reduce(
        (acc, singleAnswer) => ({
          ...acc,
          [singleAnswer.key]: singleAnswer.value ? [singleAnswer.value] : [],
        }),
        {}
      ),
      ...form.multiAnswers.reduce(
        (acc, multiAnswer) => ({
          ...acc,
          [multiAnswer.key]: multiAnswer.values,
        }),
        {}
      ),
    },
  };
}
