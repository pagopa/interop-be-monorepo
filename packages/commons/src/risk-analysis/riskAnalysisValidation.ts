import { TenantKind } from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import {
  RiskAnalysisFormToValidate,
  RiskAnalysisValidatedForm,
  RiskAnalysisValidatedSingleOrMultiAnswer,
  ValidationRule,
  ValidationRuleDependency,
} from "./models.js";
import {
  dependencyNotFoundError,
  missingExpectedFieldError,
  noTemplateVersionFoundError,
  unexpectedDependencyValueError,
  unexpectedFieldError,
  unexpectedFieldFormatError,
  unexpectedFieldValue,
  unexpectedTemplateVersionError,
} from "./riskAnalysisErrors.js";
import {
  FormTemplateQuestion,
  RiskAnalysisFormTemplate,
  dataType,
} from "./templates/models.js";
import { riskAnalysisTemplates } from "./templates/riskAnalysisTemplates.js";

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
  dependencyValue: string[] | undefined,
  dependentField: string,
  dependency: ValidationRuleDependency
): asserts dependencyValue is NonNullable<string[]> {
  if (dependencyValue === undefined) {
    throw dependencyNotFoundError(dependentField, dependency.fieldName);
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

function validateFormAnswers(
  answers: RiskAnalysisFormToValidate["answers"],
  schemaOnlyValidation: boolean,
  validationRules: ValidationRule[]
): Omit<RiskAnalysisValidatedForm, "version"> {
  if (!schemaOnlyValidation) {
    validateRequiredFields(answers, validationRules);
  }

  const validatedAnswers = Object.entries(answers).map(
    ([answerKey, answerValue]) => {
      const validationRule = validationRules.find(
        (r) => r.fieldName === answerKey
      );
      assertValidationRuleExists(validationRule, answerKey);

      validateFormField(
        answerValue,
        validationRule,
        schemaOnlyValidation,
        answers
      );

      return answerToValidatedSingleOrMultiAnswer(
        answerKey,
        answerValue,
        validationRule
      );
    }
  );

  return validatedAnswers.reduce(
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
    } as Omit<RiskAnalysisValidatedForm, "version">
  );
}

function validateFormField(
  fieldValue: string[],
  validationRule: ValidationRule,
  schemaOnlyValidation: boolean,
  answers: RiskAnalysisFormToValidate["answers"]
): void {
  if (schemaOnlyValidation) {
    validateFieldValue(fieldValue, validationRule);
  } else {
    validateFieldValue(fieldValue, validationRule);
    validationRule.dependencies.forEach((dependency) =>
      validateFieldDependency(answers, validationRule.fieldName, dependency)
    );
  }
}

function validateFieldValue(fieldValue: string[], rule: ValidationRule): void {
  match(rule.allowedValues)
    .with(P.not(P.nullish), (allowedValues) => {
      if (!fieldValue.every((v) => allowedValues.has(v))) {
        throw unexpectedFieldValue(rule.fieldName, allowedValues);
      }
    })
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    .with(P.nullish, () => {})
    .exhaustive();
}

function validateFieldDependency(
  answers: RiskAnalysisFormToValidate["answers"],
  dependentField: string,
  dependency: ValidationRuleDependency
): void {
  const dependencyValue: string[] | undefined = answers[dependency.fieldName];
  assertDependencyExists(dependencyValue, dependentField, dependency);
  if (!dependencyValue.some((v) => v === dependency.fieldValue)) {
    throw unexpectedDependencyValueError(
      dependentField,
      dependency.fieldName,
      dependency.fieldValue
    );
  }
}

function validateRequiredFields(
  answers: RiskAnalysisFormToValidate["answers"],
  validationRules: ValidationRule[]
): void {
  validationRules
    .filter((r) => r.required)
    .forEach((rule) => {
      const depsSatisfied = rule.dependencies.every((dependency) =>
        formContainsDependency(answers, dependency)
      );
      const field: string[] | undefined = answers[rule.fieldName];
      if (depsSatisfied && field === undefined) {
        throw missingExpectedFieldError(rule.fieldName);
      }
    });
}

function formContainsDependency(
  answers: RiskAnalysisFormToValidate["answers"],
  dependency: ValidationRuleDependency
): boolean {
  const field: string[] | undefined = answers[dependency.fieldName];
  return match(field)
    .with(P.not(P.nullish), (values) =>
      values.some((v) => v === dependency.fieldValue)
    )
    .with(P.nullish, () => false)
    .exhaustive();
}

function answerToValidatedSingleOrMultiAnswer(
  answerKey: string,
  answerValue: string[],
  validationRule: ValidationRule
): RiskAnalysisValidatedSingleOrMultiAnswer {
  return match(validationRule.dataType)
    .with(dataType.single, dataType.freeText, () => {
      if (answerValue.length === 0) {
        throw unexpectedFieldFormatError(answerKey);
      }
      return {
        type: "single",
        answer: {
          key: answerKey,
          value: answerValue[0],
        },
      } as RiskAnalysisValidatedSingleOrMultiAnswer;
    })
    .with(
      dataType.multi,
      () =>
        ({
          type: "multi",
          answer: {
            key: answerKey,
            values: answerValue,
          },
        } as RiskAnalysisValidatedSingleOrMultiAnswer)
    )
    .exhaustive();
}
