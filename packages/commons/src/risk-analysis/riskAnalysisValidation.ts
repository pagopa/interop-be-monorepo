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
  unexpectedDependencyValueError,
  unexpectedTemplateVersionError,
  invalidFormAnswerError,
  unexpectedFieldFormatError,
  missingExpectedFieldError,
} from "./riskAnalysisErrors.js";
import {
  RiskAnalysisFormToValidate,
  RiskAnalysisValidatedForm,
  RiskAnalysisValidatedSingleOrMultiAnswer,
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
    validRequiredFields(answers, validationRules);
  }

  const validatedAnswers = Object.entries(answers).map(
    ([fieldName, fieldValue]) => {
      const validationRule = validationRules.find(
        (r) => r.fieldName === fieldName
      );
      assertValidationRuleExists(validationRule, fieldName);
      if (
        !validFormAnswer(
          fieldValue,
          validationRule,
          schemaOnlyValidation,
          answers
        )
      ) {
        throw invalidFormAnswerError(fieldName, fieldValue, validationRule);
      }
      return answerToValidatedSingleOrMultiAnswer(
        fieldName,
        fieldValue,
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
        throw unexpectedDependencyValueError(
          dependentField,
          dependency,
          dependency.fieldValue
        );
      }
      return true;
    })
    .with(P.string, (value) => {
      if (value !== dependency.fieldValue) {
        throw unexpectedDependencyValueError(
          dependentField,
          dependency,
          dependency.fieldValue
        );
      }
      return true;
    })
    .exhaustive();
}

export function validRequiredFields(
  answers: RiskAnalysisFormToValidate["answers"],
  validationRules: ValidationRule[]
): boolean {
  return validationRules
    .filter((r) => r.required)
    .every((rule) => {
      const depsSatisfied = rule.dependencies.every((dependency) =>
        formContainsDependency(answers, dependency)
      );
      const field: string | string[] | undefined = answers[rule.fieldName];
      if (!depsSatisfied || (depsSatisfied && field !== undefined)) {
        return true;
      }
      throw missingExpectedFieldError(rule.fieldName);
    });
}

export function formContainsDependency(
  answers: RiskAnalysisFormToValidate["answers"],
  dependency: ValidationRuleDependency
): boolean {
  const field: string | string[] | undefined = answers[dependency.fieldName];
  return match(field)
    .with(P.array(P.string), (values) =>
      values.some((v) => v === dependency.fieldValue)
    )
    .with(P.string, (value) => value === dependency.fieldValue)
    .with(P.nullish, () => false)
    .exhaustive();
}

export function answerToValidatedSingleOrMultiAnswer(
  fieldName: string,
  fieldValue: string | string[],
  validationRule: ValidationRule
): RiskAnalysisValidatedSingleOrMultiAnswer {
  return match([fieldValue, validationRule.dataType])
    .with(
      [P.array(P.string), P.union(dataType.single, dataType.freeText)],
      ([values, _]) => {
        if (values.length === 0) {
          throw unexpectedFieldFormatError(fieldName);
        }
        return {
          type: "single",
          answer: {
            key: fieldName,
            value: values[0],
          },
        } as RiskAnalysisValidatedSingleOrMultiAnswer;
      }
    )
    .with(
      [P.array(P.string), dataType.multi],
      ([values, _]) =>
        ({
          type: "multi",
          answer: {
            key: fieldName,
            values,
          },
        } as RiskAnalysisValidatedSingleOrMultiAnswer)
    )
    .with([P.string, P._], () => {
      throw unexpectedFieldFormatError(fieldName);
    })
    .exhaustive();
}
