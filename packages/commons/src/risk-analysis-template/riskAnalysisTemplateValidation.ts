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

  const invalids = results.filter((r) => r.type === "invalid");
  if (invalids.length > 0) {
    return invalidTemplateResult(invalids.flatMap((r) => r.issues));
  }

  const validatedAnswers = results
    .filter((r) => r.type === "valid")
    .map((r) => r.value);

  return validTemplateResult({
    version: latestVersionFormRules.version,
    singleAnswers: validatedAnswers
      .filter((a) => a.type === "single")
      .map((a) => a.answer),
    multiAnswers: validatedAnswers
      .filter((a) => a.type === "multi")
      .map((a) => a.answer),
  });
}

// validateTemplateFormAnswers
// ├── findMissingRequiredFields
// │   └── formContainsDependency
// └── validateAllAnswerFields
//     └── validateSingleAnswerField
//         │   ├── validateFreeTextAnswer
//         │   └── validateNonFreeTextAnswer
//         │   └── validateAnswerDependency
//         └── buildValidSingleAnswerField

function validateTemplateFormAnswers(
  answers: Record<string, RiskAnalysisTemplateAnswerToValidate>,
  validationRules: ValidationRule[]
): Array<
  RiskAnalysisTemplateValidationResult<RiskAnalysisTemplateValidatedSingleOrMultiAnswer>
> {
  // check required fields
  const missingRequiredFields = findMissingRequiredFields(
    answers,
    validationRules
  );

  // early error
  if (missingRequiredFields.length > 0) {
    return [invalidTemplateResult(missingRequiredFields)];
  }

  // check all answer fields
  return validateAllAnswerFields(answers, validationRules);
}

function findMissingRequiredFields(
  answers: Record<string, RiskAnalysisTemplateAnswerToValidate>,
  validationRules: ValidationRule[]
): RiskAnalysisTemplateValidationIssue[] {
  const requiredRules = validationRules.filter((rule) => rule.required);

  return requiredRules
    .filter((rule) => {
      const isFieldMissing = answers[rule.fieldName] === undefined;

      if (!isFieldMissing) {
        return false;
      }

      return rule.dependencies.every((dependency) =>
        formContainsDependency(answers, dependency)
      );
    })
    .map((rule) => missingExpectedTemplateFieldError(rule.fieldName));
}

function validateAllAnswerFields(
  answers: Record<string, RiskAnalysisTemplateAnswerToValidate>,
  validationRules: ValidationRule[]
): Array<
  RiskAnalysisTemplateValidationResult<RiskAnalysisTemplateValidatedSingleOrMultiAnswer>
> {
  return Object.entries(answers).map(([fieldName, answerValue]) =>
    validateSingleAnswerField(fieldName, answerValue, validationRules, answers)
  );
}

function validateSingleAnswerField(
  fieldName: string,
  answerValue: RiskAnalysisTemplateAnswerToValidate,
  validationRules: ValidationRule[],
  allAnswers: Record<string, RiskAnalysisTemplateAnswerToValidate>
): RiskAnalysisTemplateValidationResult<RiskAnalysisTemplateValidatedSingleOrMultiAnswer> {
  const validationRule = validationRules.find(
    (rule) => rule.fieldName === fieldName
  );
  if (!validationRule) {
    return invalidTemplateResult([unexpectedTemplateFieldError(fieldName)]);
  }

  const valueValidationErrors = validateAnswerValue(
    answerValue,
    validationRule
  );

  const dependencyValidationErrors = validationRule.dependencies.flatMap(
    (dependencyRule) =>
      validateAnswerDependency(
        allAnswers,
        dependencyRule,
        validationRule.fieldName
      )
  );

  const validationErrors = [
    ...valueValidationErrors,
    ...dependencyValidationErrors,
  ];

  if (validationErrors.length > 0) {
    return invalidTemplateResult(validationErrors);
  }

  return buildValidSingleAnswerField(fieldName, answerValue, validationRule);
}

function validateAnswerValue(
  answer: RiskAnalysisTemplateAnswerToValidate,
  rule: ValidationRule
): RiskAnalysisTemplateValidationIssue[] {
  // editable, no values no suggestions
  if (answer.editable) {
    const hasAnyContent =
      answer.values.length > 0 || answer.suggestedValues.length > 0;
    return hasAnyContent
      ? [malformedTemplateFieldValueOrSuggestionError(rule.fieldName)]
      : [];
  }
  const hasSuggestions = answer.suggestedValues.length > 0;
  const hasValues = answer.values.length > 0;

  return match(rule)
    .with(P.nullish, () => [])

    .with({ dataType: "freeText" }, (freeTextRule) =>
      validateFreeTextAnswer(freeTextRule, hasValues, hasSuggestions)
    )

    .with({ dataType: P.not("freeText") }, (nonFreeTextRule) =>
      validateNonFreeTextAnswer(
        nonFreeTextRule,
        answer,
        hasValues,
        hasSuggestions
      )
    )

    .exhaustive();
}

function validateFreeTextAnswer(
  rule: ValidationRule,
  hasValues: boolean,
  hasSuggestions: boolean
): RiskAnalysisTemplateValidationIssue[] {
  // freeText only values or only suggestion, not either
  const hasNoContent = !hasValues && !hasSuggestions;
  const hasBothContent = hasValues && hasSuggestions;

  if (hasNoContent || hasBothContent) {
    return [malformedTemplateFieldValueOrSuggestionError(rule.fieldName)];
  }

  return [];
}

function validateNonFreeTextAnswer(
  rule: ValidationRule,
  answer: RiskAnalysisTemplateAnswerToValidate,
  hasValues: boolean,
  hasSuggestions: boolean
): RiskAnalysisTemplateValidationIssue[] {
  if (hasSuggestions || !hasValues) {
    return [unexpectedTemplateFieldValueOrSuggestionError(rule.fieldName)];
  }

  if (rule.allowedValues) {
    const hasInvalidValues = answer.values.some(
      (value) => !rule.allowedValues?.has(value)
    );

    if (hasInvalidValues) {
      return [
        unexpectedTemplateFieldValueError(rule.fieldName, rule.allowedValues),
      ];
    }
  }

  return [];
}

function validateAnswerDependency(
  answers: Record<string, RiskAnalysisTemplateAnswerToValidate>,
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

function buildValidSingleAnswerField(
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
  answers: Record<string, RiskAnalysisTemplateAnswerToValidate>,
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
