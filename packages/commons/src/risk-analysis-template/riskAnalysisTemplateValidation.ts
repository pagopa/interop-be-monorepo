import { TenantKind } from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import {
  ValidationRule,
  ValidationRuleDependency,
} from "../risk-analysis/models.js";
import {
  buildValidationRules,
  getLatestVersionFormRules,
} from "../risk-analysis/riskAnalysisValidation.js";
import {
  RiskAnalysisFormTemplateToValidate,
  RiskAnalysisTemplateAnswerToValidate,
  RiskAnalysisTemplateValidatedForm,
  RiskAnalysisTemplateValidatedSingleOrMultiAnswer,
} from "./riskAnalysisFormTemplate.js";
import {
  invalidTemplateResult,
  malformedTemplateFieldValueOrSuggestionError,
  missingExpectedTemplateFieldError,
  noRulesVersionTemplateFoundError,
  RiskAnalysisTemplateValidationIssue,
  RiskAnalysisTemplateValidationResult,
  templateDependencyNotFoundError,
  unexpectedTemplateDependencyEditableError,
  unexpectedTemplateDependencyValueError,
  unexpectedTemplateFieldError,
  unexpectedTemplateFieldValueError,
  unexpectedTemplateFieldValueOrSuggestionError,
  unexpectedTemplateRulesVersionError,
  validTemplateResult,
} from "./riskAnalysisTemplateValidationErrors.js";

// TODO: does this need schemaOnlyValidation like the other one?
export function validatePurposeTemplateRiskAnalysis(
  riskAnalysisFormTemplate: RiskAnalysisFormTemplateToValidate,
  tenantKind: TenantKind
): RiskAnalysisTemplateValidationResult<RiskAnalysisTemplateValidatedForm> {
  const latestVersionFormRules = getLatestVersionFormRules(tenantKind);

  if (latestVersionFormRules === undefined) {
    return invalidTemplateResult([
      noRulesVersionTemplateFoundError(tenantKind),
    ]);
  }

  if (latestVersionFormRules.version !== riskAnalysisFormTemplate.version) {
    return invalidTemplateResult([
      unexpectedTemplateRulesVersionError(riskAnalysisFormTemplate.version),
    ]);
  }

  const validationRules = buildValidationRules(latestVersionFormRules);

  const results = validateTemplateFormAnswers(
    riskAnalysisFormTemplate.answers,
    validationRules
  );

  if (results.some((r) => r.type === "invalid")) {
    return invalidTemplateResult(
      results.flatMap((r) => (r.type === "invalid" ? r.issues : []))
    );
  } else {
    const validatedAnswers = results.flatMap((r) =>
      r.type === "valid" ? [r.value] : []
    );

    const { singleAnswers, multiAnswers } = validatedAnswers.reduce<
      Omit<RiskAnalysisTemplateValidatedForm, "version">
    >(
      (validatedForm, answer) =>
        match(answer)
          .with({ type: "single" }, (a) => ({
            ...validatedForm,
            singleAnswers: [...validatedForm.singleAnswers, a.answer],
          }))
          .with({ type: "multi" }, (a) => ({
            ...validatedForm,
            multiAnswers: [...validatedForm.multiAnswers, a.answer],
          }))
          .exhaustive(),
      {
        singleAnswers: [],
        multiAnswers: [],
      }
    );

    return validTemplateResult({
      version: latestVersionFormRules.version,
      singleAnswers,
      multiAnswers,
    });
  }
}

function validateTemplateFormAnswers(
  answers: RiskAnalysisFormTemplateToValidate["answers"],
  validationRules: ValidationRule[]
): Array<
  RiskAnalysisTemplateValidationResult<RiskAnalysisTemplateValidatedSingleOrMultiAnswer>
> {
  // Check for missing required fields that have satisfied dependencies
  const missingRequiredFieldIssues = validationRules
    .filter((r) => r.required)
    .flatMap((rule) => {
      const templateAnswer = answers[rule.fieldName];

      // If field is missing, check if dependencies are satisfied
      if (templateAnswer === undefined) {
        const depsSatisfied = rule.dependencies.every((dependency) =>
          formContainsDependency(answers, dependency)
        );

        return depsSatisfied
          ? [missingExpectedTemplateFieldError(rule.fieldName)]
          : [];
      }

      return [];
    });

  const fieldValidationResults = Object.entries(answers).map(
    ([answerKey, answerValue]) => {
      const validationRule = validationRules.find(
        (r) => r.fieldName === answerKey
      );

      return match(validationRule)
        .with(P.nullish, () =>
          invalidTemplateResult([unexpectedTemplateFieldError(answerKey)])
        )
        .with(P.not(P.nullish), (rule) => {
          const errors = validateFormAnswer(answerValue, rule, answers);

          if (errors.length > 0) {
            return invalidTemplateResult(errors);
          } else {
            return answerToValidatedSingleOrMultiAnswer(
              answerKey,
              answerValue,
              rule
            );
          }
        })
        .exhaustive();
    }
  );

  // Combine missing required field issues with field validation results
  return missingRequiredFieldIssues.length > 0
    ? [invalidTemplateResult(missingRequiredFieldIssues)]
    : fieldValidationResults;
}

function validateFormAnswer(
  templateAnswer: RiskAnalysisTemplateAnswerToValidate,
  validationRule: ValidationRule,
  answers: RiskAnalysisFormTemplateToValidate["answers"]
): RiskAnalysisTemplateValidationIssue[] {
  return [
    ...validateAnswerValue(templateAnswer, validationRule),
    ...validationRule.dependencies.flatMap((dependencyRule) =>
      validateAnswerDependency(
        answers,
        dependencyRule,
        validationRule.fieldName
      )
    ),
  ];
}

function validateAnswerValue(
  answer: RiskAnalysisTemplateAnswerToValidate,
  rule: ValidationRule
): RiskAnalysisTemplateValidationIssue[] {
  if (answer.editable) {
    return answer.values.length > 0 || answer.suggestedValues.length > 0
      ? [malformedTemplateFieldValueOrSuggestionError(rule.fieldName)]
      : [];
  }

  const hasSuggestions = answer.suggestedValues.length > 0;
  const hasValue = answer.values.length > 0;
  return match(rule)
    .with(P.nullish, () => [])
    .with({ dataType: "freeText" }, (r) => {
      if (!hasValue && !hasSuggestions) {
        return [malformedTemplateFieldValueOrSuggestionError(r.fieldName)];
      }

      if (hasValue && hasSuggestions) {
        return [malformedTemplateFieldValueOrSuggestionError(r.fieldName)];
      }

      return [];
    })
    .with({ dataType: P.not("freeText") }, (r) => {
      // Check if values are in allowed values
      if (
        rule.allowedValues &&
        answer.values.some((e) => !rule.allowedValues?.has(e))
      ) {
        return [
          unexpectedTemplateFieldValueError(r.fieldName, rule.allowedValues),
        ];
      }

      // Check if non-freeText field has suggestions or no values
      if (hasSuggestions || !hasValue) {
        return [unexpectedTemplateFieldValueOrSuggestionError(r.fieldName)];
      }

      return [];
    })
    .exhaustive();
}

function validateAnswerDependency(
  answers: RiskAnalysisFormTemplateToValidate["answers"],
  dependency: ValidationRuleDependency,
  dependentField: string
): RiskAnalysisTemplateValidationIssue[] {
  return match(answers[dependency.fieldName])
    .with(P.nullish, () => [
      templateDependencyNotFoundError(dependentField, dependency.fieldName),
    ])
    .with({ editable: true }, () => [
      unexpectedTemplateDependencyEditableError(
        dependentField,
        dependency.fieldName
      ),
    ])
    .with({ values: P.when((v) => !v.includes(dependency.fieldValue)) }, () => [
      unexpectedTemplateDependencyValueError(
        dependentField,
        dependency.fieldName,
        dependency.fieldValue
      ),
    ])
    .otherwise(() => []);
}

function answerToValidatedSingleOrMultiAnswer(
  answerKey: string,
  answerValue: RiskAnalysisTemplateAnswerToValidate,
  validationRule: ValidationRule
): RiskAnalysisTemplateValidationResult<RiskAnalysisTemplateValidatedSingleOrMultiAnswer> {
  return match(validationRule.dataType)
    .with("single", "freeText", () =>
      validTemplateResult<RiskAnalysisTemplateValidatedSingleOrMultiAnswer>({
        type: "single",
        answer: {
          key: answerKey,
          value: answerValue.values[0] ?? undefined,
          editable: answerValue.editable,
          suggestedValues: answerValue.suggestedValues,
        },
      })
    )
    .with("multi", () =>
      validTemplateResult<RiskAnalysisTemplateValidatedSingleOrMultiAnswer>({
        type: "multi",
        answer: {
          key: answerKey,
          values: answerValue.values,
          editable: answerValue.editable,
        },
      })
    )
    .exhaustive();
}

function formContainsDependency(
  answers: RiskAnalysisFormTemplateToValidate["answers"],
  dependency: ValidationRuleDependency
): boolean {
  const field = answers[dependency.fieldName];
  return match(field)
    .with(P.not(P.nullish), (answerToValidate) =>
      answerToValidate.values.some((v) => v === dependency.fieldValue)
    )
    .with(P.nullish, () => false)
    .exhaustive();
}
