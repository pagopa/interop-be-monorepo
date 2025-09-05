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

/*
validatePurposeTemplateRiskAnalysis
├── getLatestVersionFormRules
├── buildValidationRules
└── validateTemplateFormAnswers
    ├── findMissingRequiredFields
    │   └── formContainsDependency
    └── validateAllAnswers
        └── validateAnswer
            ├── validateAnswerValue
            │   ├── validateFreeTextAnswer
            │   └── validateNonFreeTextAnswer
            ├── validateAnswerDependency
            └── buildValidResultAnswer
*/
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
    return invalidTemplateResult(
      results.flatMap((r) => (r.type === "invalid" ? r.issues : []))
    );
  }

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

function validateTemplateFormAnswers(
  answers: Record<string, RiskAnalysisTemplateAnswerToValidate>,
  validationRules: ValidationRule[]
): Array<
  RiskAnalysisTemplateValidationResult<RiskAnalysisTemplateValidatedSingleOrMultiAnswer>
> {
  // Check for missing required fields that have satisfied dependencies
  const missingRequiredFieldIssues = findMissingRequiredFields(
    answers,
    validationRules
  );

  // early error
  if (missingRequiredFieldIssues.length > 0) {
    return [invalidTemplateResult(missingRequiredFieldIssues)];
  }

  // check all answer fields
  return validateAllAnswers(answers, validationRules);
}

function findMissingRequiredFields(
  answers: Record<string, RiskAnalysisTemplateAnswerToValidate>,
  validationRules: ValidationRule[]
): RiskAnalysisTemplateValidationIssue[] {
  return validationRules
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
  /*
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
    */
}

function validateAllAnswers(
  answers: Record<string, RiskAnalysisTemplateAnswerToValidate>,
  validationRules: ValidationRule[]
): Array<
  RiskAnalysisTemplateValidationResult<RiskAnalysisTemplateValidatedSingleOrMultiAnswer>
> {
  return Object.entries(answers).map(([answerKey, answerValue]) =>
    validateAnswer(answerKey, answerValue, validationRules, answers)
  );
}

// ex validateFormAnswer
function validateAnswer(
  answerKey: string,
  answerValue: RiskAnalysisTemplateAnswerToValidate,
  validationRules: ValidationRule[],
  allAnswers: Record<string, RiskAnalysisTemplateAnswerToValidate>
): RiskAnalysisTemplateValidationResult<RiskAnalysisTemplateValidatedSingleOrMultiAnswer> {
  const validationRule = validationRules.find(
    (rule) => rule.fieldName === answerKey
  );
  if (!validationRule) {
    return invalidTemplateResult([unexpectedTemplateFieldError(answerKey)]);
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

  return buildValidResultAnswer(answerKey, answerValue, validationRule);
}

function validateAnswerValue(
  answer: RiskAnalysisTemplateAnswerToValidate,
  rule: ValidationRule
): RiskAnalysisTemplateValidationIssue[] {
  const hasSuggestions = answer.suggestedValues.length > 0;
  const hasValues = answer.values.length > 0;

  if (answer.editable) {
    const hasAnyContent = hasValues || hasSuggestions;
    return hasAnyContent
      ? [malformedTemplateFieldValueOrSuggestionError(rule.fieldName)]
      : [];
  }

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
  if (!hasValues && !hasSuggestions) {
    return [malformedTemplateFieldValueOrSuggestionError(rule.fieldName)];
  }

  if (hasValues && hasSuggestions) {
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
  // Check if values are in allowed values
  if (
    rule.allowedValues &&
    answer.values.some((e) => !rule.allowedValues?.has(e))
  ) {
    return [
      unexpectedTemplateFieldValueError(rule.fieldName, rule.allowedValues),
    ];
  }

  // Check if non-freeText field has suggestions or no values
  if (hasSuggestions || !hasValues) {
    return [unexpectedTemplateFieldValueOrSuggestionError(rule.fieldName)];
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

function buildValidResultAnswer(
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
