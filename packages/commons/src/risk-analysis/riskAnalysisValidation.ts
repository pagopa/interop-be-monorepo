import { TenantKind } from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import {
  FormTemplateQuestion,
  RiskAnalysisFormTemplate,
  dataType,
  riskAnalysisTemplates,
} from "./riskAnalysisTemplates.js";
import {
  dependencyNotFound,
  noTemplateVersionFoundError,
  unexpectedFieldError,
  unexpectedFieldValue,
  unexpectedFieldValueByDependencyError,
  unexpectedTemplateVersionError,
} from "./riskAnalysisErrors.js";
import {
  RiskAnalysisFormToValidate,
  RiskAnalysisValidatedForm,
  ValidationRule,
  ValidationRuleDependency,
} from "./models.js";

function assertLatestVersionTemplateFormExists(
  latestVersionTemplateForm: RiskAnalysisFormTemplate | undefined,
  tenantKind: TenantKind
): asserts latestVersionTemplateForm is NonNullable<RiskAnalysisFormTemplate> {
  if (latestVersionTemplateForm === undefined) {
    throw noTemplateVersionFoundError(tenantKind);
  }
}

function assertValidationRuleExists(
  validationRule: ValidationRule | undefined,
  answerKey: string
): asserts validationRule is NonNullable<ValidationRule> {
  if (validationRule === undefined) {
    throw unexpectedFieldError(answerKey);
  }
}

function assertDependencyExists(
  dependencyValue: string | string[] | undefined,
  dependentField: string,
  dependency: ValidationRuleDependency
): asserts dependencyValue is NonNullable<string | string[]> {
  if (dependencyValue === undefined) {
    throw dependencyNotFound(dependentField, dependency);
  }
}

export function validateRiskAnalysis(
  riskAnalysisForm: RiskAnalysisFormToValidate,
  schemaOnlyValidation: boolean,
  tenantKind: TenantKind
): RiskAnalysisValidatedForm {
  const latestVersionTemplateForm = getLatestVersionTemplateForm(tenantKind);
  assertLatestVersionTemplateFormExists(latestVersionTemplateForm, tenantKind);

  if (latestVersionTemplateForm.version !== riskAnalysisForm.version) {
    throw unexpectedTemplateVersionError(riskAnalysisForm.version);
  }

  const validationRules = latestVersionTemplateForm.questions.map(
    questionToValidationRule
  );

  const sanitizedAnswers = Object.fromEntries(
    Object.entries(riskAnalysisForm.answers).filter(([, v]) => v.length > 0)
  );

  const { singleAnswers, multiAnswers } = validateFormAnswers(
    sanitizedAnswers,
    schemaOnlyValidation,
    validationRules
  );

  return {
    version: latestVersionTemplateForm.version,
    singleAnswers,
    multiAnswers,
  };
}

function getLatestVersionTemplateForm(
  tenantKind: TenantKind
): RiskAnalysisFormTemplate | undefined {
  const templates = riskAnalysisTemplates[tenantKind];
  try {
    return templates
      .map((t) => ({
        floatVersion: parseFloat(t.version),
        template: t,
      }))
      .sort((a, b) => b.floatVersion - a.floatVersion)
      .map((t) => t.template)[0];
  } catch {
    return undefined;
  }
}

function templateDepsToValidationRuleDeps(
  dependencies: FormTemplateQuestion["dependencies"]
): ValidationRuleDependency[] {
  return dependencies.map((d) => ({
    fieldName: d.id,
    fieldValue: d.value,
  }));
}

function questionToValidationRule(
  question: FormTemplateQuestion
): ValidationRule {
  return match(question)
    .with({ dataType: dataType.freeText }, (q) => ({
      fieldName: q.id,
      dataType: q.dataType,
      required: q.required,
      dependencies: templateDepsToValidationRuleDeps(q.dependencies),
      allowedValues: undefined,
    }))
    .with(
      { dataType: dataType.single },
      {
        dataType: dataType.multi,
      },
      (q) => ({
        fieldName: q.id,
        dataType: q.dataType,
        required: q.required,
        dependencies: templateDepsToValidationRuleDeps(q.dependencies),
        allowedValues: new Set(q.options.map((o) => o.value)),
      })
    )
    .exhaustive();
}

export function validateFormAnswers(
  answers: RiskAnalysisFormToValidate["answers"],
  schemaOnlyValidation: boolean,
  validationRules: ValidationRule[]
): Omit<RiskAnalysisValidatedForm, "version"> {
  if (!schemaOnlyValidation) {
    validateExpectedFields(answers, validationRules);
  }

  Object.entries(answers).forEach(([answerKey, answerValue]) => {
    const validationRule = validationRules.find(
      (r) => r.fieldName === answerKey
    );
    assertValidationRuleExists(validationRule, answerKey);
    validFormAnswer(answerValue, validationRule, schemaOnlyValidation, answers);
  });
  // TODO convert into right format and return instead of mock
  return {
    singleAnswers: [],
    multiAnswers: [],
  };
}

export function validFormAnswer(
  answerValue: string | string[],
  validationRule: ValidationRule,
  schemaOnlyValidation: boolean,
  answers: RiskAnalysisFormToValidate["answers"]
): boolean {
  if (schemaOnlyValidation) {
    return validAnswerValue(answerValue, validationRule);
  } else {
    return (
      validAnswerValue(answerValue, validationRule) &&
      validationRule.dependencies.every((dependency) =>
        validAnswerDependency(answers, validationRule.fieldName, dependency)
      )
    );
  }
}

function validAnswerValue(
  answerValue: string | string[],
  rule: ValidationRule
): boolean {
  return match([rule.allowedValues, answerValue])
    .with([P.not(P.nullish), P.array(P.string)], ([allowedValues, values]) => {
      if (!values.every((v) => allowedValues.has(v))) {
        throw unexpectedFieldValue(rule.fieldName, allowedValues);
      }
      return true;
    })
    .with([P.not(P.nullish), P.string], ([allowedValues, value]) => {
      if (!allowedValues.has(value)) {
        throw unexpectedFieldValue(rule.fieldName, allowedValues);
      }
      return true;
    })
    .with([P.nullish, P._], () => true)
    .exhaustive();
}

function validAnswerDependency(
  answers: RiskAnalysisFormToValidate["answers"],
  dependentField: string,
  dependency: ValidationRuleDependency
): boolean {
  const dependencyValue: string | string[] | undefined =
    answers[dependency.fieldName];
  assertDependencyExists(dependencyValue, dependentField, dependency);
  return match(dependencyValue)
    .with(P.array(P.string), (values) => {
      if (!values.some((v) => v === dependency.fieldValue)) {
        throw unexpectedFieldValueByDependencyError(
          dependentField,
          dependency,
          dependency.fieldValue
        );
      }
      return true;
    })
    .with(P.string, (value) => {
      if (value !== dependency.fieldValue) {
        throw unexpectedFieldValueByDependencyError(
          dependentField,
          dependency,
          dependency.fieldValue
        );
      }
      return true;
    })
    .exhaustive();
}

export function validateExpectedFields(
  _answers: RiskAnalysisFormToValidate["answers"],
  _validationRules: ValidationRule[]
): void {
  // mock implementation
  return undefined;
}
