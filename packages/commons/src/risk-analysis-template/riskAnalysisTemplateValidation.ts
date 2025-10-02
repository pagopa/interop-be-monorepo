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
  malformedRiskAnalysisTemplateFieldValueOrSuggestionError,
  missingExpectedRiskAnalysisTemplateFieldError,
  noRiskAnalysisTemplateRulesVersionFoundError,
  RiskAnalysisTemplateValidationIssue,
  RiskAnalysisTemplateValidationResult,
  riskAnalysisTemplateDependencyNotFoundError,
  unexpectedRiskAnalysisTemplateDependencyEditableError,
  unexpectedRiskAnalysisTemplateDependencyValueError,
  unexpectedRiskAnalysisTemplateFieldError,
  unexpectedRiskAnalysisTemplateFieldValueError,
  unexpectedRiskAnalysisTemplateRulesVersionError,
  validTemplateResult,
  unexpectedRiskAnalysisTemplateFieldValueOrSuggestionError,
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
      noRiskAnalysisTemplateRulesVersionFoundError(tenantKind),
    ]);
  }

  if (latestVersionFormRules.version !== riskAnalysisFormTemplate.version) {
    return invalidTemplateResult([
      unexpectedRiskAnalysisTemplateRulesVersionError(
        riskAnalysisFormTemplate.version
      ),
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
  const missingRequiredFieldIssues = findMissingRequiredFields(
    answers,
    validationRules
  );

  if (missingRequiredFieldIssues.length > 0) {
    return [invalidTemplateResult(missingRequiredFieldIssues)];
  }

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

      if (templateAnswer === undefined) {
        const depsSatisfied = rule.dependencies.every((dependency) =>
          formContainsDependency(answers, dependency)
        );

        return depsSatisfied
          ? [missingExpectedRiskAnalysisTemplateFieldError(rule.fieldName)]
          : [];
      }
      return [];
    });
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
    return invalidTemplateResult([
      unexpectedRiskAnalysisTemplateFieldError(answerKey),
    ]);
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
      ? [
          malformedRiskAnalysisTemplateFieldValueOrSuggestionError(
            rule.fieldName
          ),
        ]
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
    return [
      malformedRiskAnalysisTemplateFieldValueOrSuggestionError(rule.fieldName),
    ];
  }

  if (hasValues && hasSuggestions) {
    return [
      malformedRiskAnalysisTemplateFieldValueOrSuggestionError(rule.fieldName),
    ];
  }

  return [];
}

function validateNonFreeTextAnswer(
  rule: ValidationRule,
  answer: RiskAnalysisTemplateAnswerToValidate,
  hasValues: boolean,
  hasSuggestions: boolean
): RiskAnalysisTemplateValidationIssue[] {
  if (
    rule.allowedValues &&
    answer.values.some((e) => !rule.allowedValues?.has(e))
  ) {
    return [
      unexpectedRiskAnalysisTemplateFieldValueError(
        rule.fieldName,
        rule.allowedValues
      ),
    ];
  }

  if (hasSuggestions || !hasValues) {
    return [
      unexpectedRiskAnalysisTemplateFieldValueOrSuggestionError(rule.fieldName),
    ];
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
      riskAnalysisTemplateDependencyNotFoundError(
        dependentField,
        dependency.fieldName
      ),
    ])
    .with({ editable: true }, () => [
      unexpectedRiskAnalysisTemplateDependencyEditableError(
        dependentField,
        dependency.fieldName
      ),
    ])
    .with({ values: P.when((v) => !v.includes(dependency.fieldValue)) }, () => [
      unexpectedRiskAnalysisTemplateDependencyValueError(
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
          value: answerValue.values[0],
          editable: answerValue.editable,
          suggestedValues: answerValue.suggestedValues,
          annotation: answerValue.annotation,
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
          annotation: answerValue.annotation,
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
