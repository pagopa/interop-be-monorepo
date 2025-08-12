import {
  buildValidationRules,
  getLatestVersionFormRules,
  invalidResult,
  noRulesVersionFoundError,
  RiskAnalysisFormTemplateToValidate,
  RiskAnalysisTemplateAnswer,
  RiskAnalysisTemplateValidationIssue,
  RiskAnalysisValidatedSingleOrMultiAnswer,
  RiskAnalysisValidationResult,
  unexpectedFieldError,
  unexpectedFieldValueOrSuggestion,
  unexpectedRulesVersionError,
  unexpectedFieldValueTemplateError,
  ValidationRule,
} from "pagopa-interop-commons";
import { RiskAnalysisFormTemplate, TenantKind } from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import {
  missingFreeOfChargeReason,
  purposeTemplateNameConflict,
} from "../model/domain/errors.js";

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
  readModelService: ReadModelService;
  title: string;
}): Promise<void> => {
  const purposeTemplateWithSameName = await readModelService.getPurposeTemplate(
    title
  );

  if (purposeTemplateWithSameName) {
    throw purposeTemplateNameConflict();
  }
};

export function validatePurposeTemplateRiskAnalysis(
  riskAnalysisFormTemplate: RiskAnalysisFormTemplateToValidate,
  schemaOnlyValidation: boolean,
  tenantKind: TenantKind
): RiskAnalysisValidationResult<RiskAnalysisFormTemplate> | undefined {
  if (!riskAnalysisFormTemplate) {
    return undefined;
  }
  const latestVersionFormRules = getLatestVersionFormRules(tenantKind);

  if (latestVersionFormRules === undefined) {
    return invalidResult([noRulesVersionFoundError(tenantKind)]);
  }

  if (latestVersionFormRules.version !== riskAnalysisFormTemplate.version) {
    return invalidResult([
      unexpectedRulesVersionError(riskAnalysisFormTemplate.version),
    ]);
  }

  const validationRules = buildValidationRules(latestVersionFormRules);

  const results = validateTemplateFormAnswers(
    riskAnalysisFormTemplate.answers,
    schemaOnlyValidation,
    validationRules
  );
}

function validateTemplateFormAnswers(
  answers: RiskAnalysisFormTemplateToValidate["answers"],
  schemaOnlyValidation: boolean,
  validationRules: ValidationRule[]
): Array<
  RiskAnalysistValidationResult<RiskAnalysisValidatedSingleOrMultiAnswer>
> {
  return Object.entries(answers)
    .map(([answerKey, answerValue]) => {
      const validationRule = validationRules.find(
        (r) => r.fieldName === answerKey
      );

      return match(validationRule)
        .with(P.nullish, () => invalidResult([unexpectedFieldError(answerKey)]))
        .with(P.not(P.nullish), (rule) => {
          const errors = validateFormField(
            answerValue,
            rule,
            schemaOnlyValidation,
            answers
          );

          if (errors.length > 0) {
            return invalidResult(errors);
          } else {
            return answerToValidatedSingleOrMultiAnswer(
              answerKey,
              answerValue,
              rule
            );
          }
        })
        .exhaustive();
    }) // todo valutare se tenere questo concat
    .concat(
      match(schemaOnlyValidation)
        .with(true, () => [])
        .with(false, () => {
          const errors = validateRequiredFields(answers, validationRules);

          if (errors.length > 0) {
            return [invalidResult(errors)];
          } else {
            return [];
          }
        })
        .exhaustive()
    );
}

function validateFormField(
  fieldValue: RiskAnalysisTemplateAnswer,
  validationRule: ValidationRule,
  answers: RiskAnalysisFormTemplateToValidate["answers"]
): RiskAnalysisTemplateValidationIssue[] {
  return [
    ...validateFieldValue(fieldValue, validationRule),
    ...validationRule.dependencies.flatMap,
    (dependency) =>
      validateAnswerDependency(answers, validationRule.fieldName, dependency),
  ];
}

function validateFieldValue(
  answer: RiskAnalysisTemplateAnswer,
  rule: ValidationRule
): RiskAnalysisTemplateValidationIssue[] {
  if (answer.editable) {
    return answer.value.length > 0 || answer.suggestedValues.length > 0
      ? [unexpectedFieldValueOrSuggestion(rule.fieldName)]
      : [];
  }
  return match(rule.allowedValues)
    .with(P.not(P.nullish), (allowedValues) => {
      if (answer.value && !allowedValues.has(answer.value)) {
        return [
          unexpectedFieldValueTemplateError(rule.fieldName, allowedValues),
        ];
      }

      if (answer.suggestedValues.some((v) => allowedValues.has(v))) {
        return [
          unexpectedFieldValueTemplateError(rule.fieldName, allowedValues),
        ];
      }

      return [];
    })
    .with(P.nullish, () => [])
    .exhaustive();
}

// todo ma serve dependentField?
function validateAnswerDependency(
  answers: RiskAnalysisFormTemplateToValidate["answers"],
  dependentField: string,
  dependency: ValidationRuleDependency
): RiskAnalysisTemplateValidationIssue[] {
  const dependencyAnswer: RiskAnalysisTemplateAnswer | undefined =
    answers[dependency.fieldName];
  if (dependencyAnswer === undefined) {
    return [dependencyNotFoundError(dependentField, dependency.fieldName)];
  }

  if (dependencyAnswer.value !== dependency.fieldValue) {
    return [
      unexpectedDependencyValueError(
        dependentField,
        dependency.fieldName,
        dependency.fieldValue
      ),
    ];
  }
}

function getSanitizedTemplateAnswers(
  form: RiskAnalysisFormTemplateToValidate
): RiskAnalysisFormTemplateToValidate["answers"] {
  return Object.fromEntries(
    Object.entries(form.answers).filter(([, v]) => {
      //  case 1 : value && !editable - Suggestion Not allowed
      //  case 2 : !value && editable && suggestions
      //  case 3 : value && editable && suggestions
      //  case 4 : !value && !editable && !suggestions
      //  case 5 : value && editable && !suggestions
      //  case 6 : !value && editable && !suggestions
      //  case 7 : !value && !editable && suggestions
      //  case 8 : value && !editable && suggestions
      //  case 9 : !value && !editable && suggestions
      //  case 10: value && editable && suggestions

      const hasValue = v.value.trim().length > 0;

      const hasSuggestions = v.suggestedValues.length > 0;

      // check on v.editable removes answers that are editable,
      // ensure that only answers with values or suggestions are kept for validation and storage
      return hasValue || hasSuggestions || v.editable;
    })
  );
}
