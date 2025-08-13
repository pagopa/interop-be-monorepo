import {
  buildValidationRules,
  getLatestVersionFormRules,
  invalidTemplateResult,
  malformedTemplateFieldValueOrSuggestion,
  missingExpectedTemplateFieldError,
  noRulesVersionTemplateFoundError,
  RiskAnalysisFormTemplateToValidate,
  RiskAnalysisTemplateAnswerToValidate,
  RiskAnalysisTemplateValidatedForm,
  RiskAnalysisTemplateValidatedSingleOrMultiAnswer,
  RiskAnalysisTemplateValidationIssue,
  RiskAnalysisTemplateValidationResult,
  riskAnalysisValidatedFormTemplateToNewRiskAnalysisFormTemplate,
  templateDependencyNotFoundError,
  unexpectedTemplateDependencyEditableError,
  unexpectedTemplateDependencyValueError,
  unexpectedTemplateFieldError,
  unexpectedTemplateFieldValueError,
  unexpectedTemplateFieldValueOrSuggestion,
  unexpectedTemplateRulesVersionError,
  ValidationRule,
  ValidationRuleDependency,
  validTemplateResult,
} from "pagopa-interop-commons";
import { RiskAnalysisFormTemplate, TenantKind } from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  missingFreeOfChargeReason,
  purposeTemplateNameConflict,
  riskAnalysisTemplateValidationFailed,
} from "../model/domain/errors.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";

export const assertConsistentFreeOfCharge = (
  isFreeOfCharge: boolean,
  freeOfChargeReason: string | undefined
): void => {
  if (isFreeOfCharge && !freeOfChargeReason) {
    throw missingFreeOfChargeReason();
  }
};

export const assertValidPuposeTemplateName = (
  purposeTemplateName: string | undefined
): void => {
  if (!purposeTemplateName || purposeTemplateName.length < 3) {
    throw purposeTemplateNameConflict();
  }
};

export const assertPurposeTemplateTitleIsNotDuplicated = async ({
  readModelService,
  title,
}: {
  readModelService: ReadModelServiceSQL;
  title: string;
}): Promise<void> => {
  const purposeTemplateWithSameName = await readModelService.getPurposeTemplate(
    title
  );

  if (purposeTemplateWithSameName) {
    throw purposeTemplateNameConflict();
  }
};

export function validateAndTransformRiskAnalysisTemplate(
  purposeRiskAnalysisForm:
    | purposeTemplateApi.RiskAnalysisFormTemplateSeed
    | undefined,
  tenantKind: TenantKind
): RiskAnalysisFormTemplate | undefined {
  if (!purposeRiskAnalysisForm) {
    return undefined;
  }

  const validatedForm = validateRiskAnalysisOrThrow({
    riskAnalysisForm: purposeRiskAnalysisForm,
    tenantKind,
  });

  return riskAnalysisValidatedFormTemplateToNewRiskAnalysisFormTemplate(
    validatedForm
  );
}

export function validateRiskAnalysisOrThrow({
  riskAnalysisForm,
  tenantKind,
}: {
  riskAnalysisForm: purposeTemplateApi.RiskAnalysisFormTemplateSeed;
  tenantKind: TenantKind;
}): RiskAnalysisTemplateValidatedForm {
  const result = validatePurposeTemplateRiskAnalysis(
    riskAnalysisForm,
    tenantKind
  );

  if (result.type === "invalid") {
    throw riskAnalysisTemplateValidationFailed(result.issues);
  } else {
    return result.value;
  }
}

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
  return Object.entries(answers)
    .map(([answerKey, answerValue]) => {
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
    })
    .concat(
      invalidTemplateResult(
        validateTemplateRequiredFields(answers, validationRules)
      )
    );
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
      ? [unexpectedTemplateFieldValueOrSuggestion(rule.fieldName)]
      : [];
  }

  const hasSuggestions = answer.suggestedValues.length > 0;
  const hasValue = answer.values.length > 0;
  return match(rule)
    .with(P.nullish, () => [])
    .with({ dataType: "freeText" }, (r) => {
      if (!hasValue && !hasSuggestions) {
        return [unexpectedTemplateFieldValueOrSuggestion(r.fieldName)];
      }

      if (hasValue && hasSuggestions) {
        return [malformedTemplateFieldValueOrSuggestion(r.fieldName)];
      }

      return [];
    })
    .with({ dataType: P.not("freeText") }, () =>
      rule.allowedValues &&
      answer.values.some((e) => !rule.allowedValues?.has(e))
        ? [
            unexpectedTemplateFieldValueError(
              rule.fieldName,
              rule.allowedValues
            ),
          ]
        : []
    )
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

function validateTemplateRequiredFields(
  answers: RiskAnalysisFormTemplateToValidate["answers"],
  validationRules: ValidationRule[]
): RiskAnalysisTemplateValidationIssue[] {
  return validationRules
    .filter((r) => r.required)
    .flatMap((rule) => {
      const templateAnswer = answers[rule.fieldName];

      if (templateAnswer === undefined) {
        return [missingExpectedTemplateFieldError(rule.fieldName)];
      }

      // if the field is editable, require fields are not checked
      if (templateAnswer.editable) {
        return [];
      }

      if (
        rule.dataType === "freeText" &&
        !templateAnswer.editable &&
        !templateAnswer.values.length &&
        !templateAnswer.suggestedValues.length
      ) {
        return [unexpectedTemplateFieldValueOrSuggestion(rule.fieldName)];
      }

      if (!templateAnswer.editable && !templateAnswer.values.length) {
        return [unexpectedTemplateFieldValueOrSuggestion(rule.fieldName)];
      }

      return [];
    });
}
