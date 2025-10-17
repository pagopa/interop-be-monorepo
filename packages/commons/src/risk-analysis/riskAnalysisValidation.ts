import { tenantKind, TenantKind } from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import {
  RiskAnalysisFormToValidate,
  RiskAnalysisValidatedForm,
  RiskAnalysisValidatedSingleOrMultiAnswer,
  RiskAnalysisValidationInvalid,
  RiskAnalysisValidationResult,
  ValidationRule,
  ValidationRuleDependency,
} from "./models.js";
import {
  RiskAnalysisValidationIssue,
  dependencyNotFoundError,
  expiredRulesVersionError,
  missingExpectedFieldError,
  rulesVersionNotFoundError,
  unexpectedDependencyValueError,
  unexpectedFieldError,
  unexpectedFieldFormatError,
  unexpectedFieldValueError,
} from "./riskAnalysisValidationErrors.js";
import {
  FormQuestionRules,
  RiskAnalysisFormRules,
  dataType,
} from "./rules/riskAnalysisFormRules.js";
import { riskAnalysisFormRules } from "./rules/riskAnalysisFormRulesProvider.js";

export function validateRiskAnalysis(
  riskAnalysisForm: RiskAnalysisFormToValidate,
  schemaOnlyValidation: boolean,
  tenantKind: TenantKind,
  dateForExpirationValidation: Date
): RiskAnalysisValidationResult<RiskAnalysisValidatedForm> {
  const formRulesForValidation = getFormRulesByVersion(
    tenantKind,
    riskAnalysisForm.version
  );

  if (formRulesForValidation === undefined) {
    return invalidResult([
      rulesVersionNotFoundError(tenantKind, riskAnalysisForm.version),
    ]);
  }

  if (
    formRulesForValidation.expiration &&
    formRulesForValidation.expiration < dateForExpirationValidation
  ) {
    return invalidResult([
      expiredRulesVersionError(riskAnalysisForm.version, tenantKind),
    ]);
  }

  const validationRules = buildValidationRules(formRulesForValidation);

  const sanitizedAnswers = getSanitizedAnswers(riskAnalysisForm);

  const results = validateFormAnswers(
    sanitizedAnswers,
    schemaOnlyValidation,
    validationRules
  );

  if (results.some((r) => r.type === "invalid")) {
    return invalidResult(
      results.flatMap((r) => (r.type === "invalid" ? r.issues : []))
    );
  } else {
    const validatedAnswers = results.flatMap((r) =>
      r.type === "valid" ? [r.value] : []
    );

    const { singleAnswers, multiAnswers } = validatedAnswers.reduce<
      Omit<RiskAnalysisValidatedForm, "version">
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

    return validResult({
      version: formRulesForValidation.version,
      singleAnswers,
      multiAnswers,
    });
  }
}

function getSanitizedAnswers(
  riskAnalysisForm: RiskAnalysisFormToValidate
): RiskAnalysisFormToValidate["answers"] {
  return Object.fromEntries(
    Object.entries(riskAnalysisForm.answers).filter(([, v]) => v.length > 0)
  );
}

export function getLatestVersionFormRules(
  tenantKind: TenantKind
): RiskAnalysisFormRules | undefined {
  const rules = riskAnalysisFormRules[tenantKind];
  try {
    return rules
      .map((rules) => ({
        floatVersion: parseFloat(rules.version),
        rules,
      }))
      .sort((a, b) => b.floatVersion - a.floatVersion)
      .map(({ rules }) => rules)[0];
  } catch {
    return undefined;
  }
}

export function getFormRulesByVersion(
  tenantKind: TenantKind,
  version: string
): RiskAnalysisFormRules | undefined {
  return riskAnalysisFormRules[tenantKind].find(
    (config) => config.version === version
  );
}

/*
Get all the not expired risk analysis form rules (without expiration date and within the grace period) for each tenant kind
*/
export function getValidFormRulesVersions(): Map<TenantKind, string[]> {
  const validFormRulesByTenantKind = new Map<TenantKind, string[]>();
  for (const kind of Object.values(tenantKind)) {
    validFormRulesByTenantKind.set(
      kind,
      riskAnalysisFormRules[kind]
        .filter(
          (rule) =>
            !rule.expiration ||
            rule.expiration >= new Date(new Date().toDateString())
        )
        .map((rule) => rule.version)
    );
  }

  return validFormRulesByTenantKind;
}

function questionRulesDepsToValidationRuleDeps(
  dependencies: FormQuestionRules["dependencies"]
): ValidationRuleDependency[] {
  return dependencies.map((d) => ({
    fieldName: d.id,
    fieldValue: d.value,
  }));
}

export function buildValidationRules(
  formRules: RiskAnalysisFormRules
): ValidationRule[] {
  return formRules.questions.map(buildValidationRule);
}

function buildValidationRule(question: FormQuestionRules): ValidationRule {
  return match(question)
    .with({ dataType: dataType.freeText }, (q) => ({
      fieldName: q.id,
      dataType: q.dataType,
      required: q.required,
      dependencies: questionRulesDepsToValidationRuleDeps(q.dependencies),
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
        dependencies: questionRulesDepsToValidationRuleDeps(q.dependencies),
        allowedValues: new Set(q.options.map((o) => o.value)),
      })
    )
    .exhaustive();
}

function validateFormAnswers(
  answers: RiskAnalysisFormToValidate["answers"],
  schemaOnlyValidation: boolean,
  validationRules: ValidationRule[]
): Array<
  RiskAnalysisValidationResult<RiskAnalysisValidatedSingleOrMultiAnswer>
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
    })
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
  fieldValue: string[],
  validationRule: ValidationRule,
  schemaOnlyValidation: boolean,
  answers: RiskAnalysisFormToValidate["answers"]
): RiskAnalysisValidationIssue[] {
  return match(schemaOnlyValidation)
    .with(true, () => validateFieldValue(fieldValue, validationRule))
    .with(false, () => [
      ...validateFieldValue(fieldValue, validationRule),
      ...validationRule.dependencies.flatMap((dependency) =>
        validateFieldDependency(answers, validationRule.fieldName, dependency)
      ),
    ])
    .exhaustive();
}

function validateFieldValue(
  fieldValue: string[],
  rule: ValidationRule
): RiskAnalysisValidationIssue[] {
  return match(rule.allowedValues)
    .with(P.not(P.nullish), (allowedValues) =>
      fieldValue.flatMap((v) =>
        allowedValues.has(v)
          ? []
          : [unexpectedFieldValueError(rule.fieldName, allowedValues)]
      )
    )
    .with(P.nullish, () => [])
    .exhaustive();
}

function validateFieldDependency(
  answers: RiskAnalysisFormToValidate["answers"],
  dependentField: string,
  dependency: ValidationRuleDependency
): RiskAnalysisValidationIssue[] {
  const dependencyValue: string[] | undefined = answers[dependency.fieldName];
  if (dependencyValue === undefined) {
    return [dependencyNotFoundError(dependentField, dependency.fieldName)];
  }

  if (!dependencyValue.some((v) => v === dependency.fieldValue)) {
    return [
      unexpectedDependencyValueError(
        dependentField,
        dependency.fieldName,
        dependency.fieldValue
      ),
    ];
  }

  return [];
}

function validateRequiredFields(
  answers: RiskAnalysisFormToValidate["answers"],
  validationRules: ValidationRule[]
): RiskAnalysisValidationIssue[] {
  return validationRules
    .filter((r) => r.required)
    .flatMap((rule) => {
      const depsSatisfied = rule.dependencies.every((dependency) =>
        formContainsDependency(answers, dependency)
      );
      const field: string[] | undefined = answers[rule.fieldName];
      if (depsSatisfied && field === undefined) {
        return [missingExpectedFieldError(rule.fieldName)];
      } else {
        return [];
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
): RiskAnalysisValidationResult<RiskAnalysisValidatedSingleOrMultiAnswer> {
  return match(validationRule.dataType)
    .with(dataType.single, dataType.freeText, () => {
      if (answerValue.length === 0) {
        return invalidResult([unexpectedFieldFormatError(answerKey)]);
      }
      return validResult<RiskAnalysisValidatedSingleOrMultiAnswer>({
        type: "single",
        answer: {
          key: answerKey,
          value: answerValue[0],
        },
      });
    })
    .with(dataType.multi, () =>
      validResult<RiskAnalysisValidatedSingleOrMultiAnswer>({
        type: "multi",
        answer: {
          key: answerKey,
          values: answerValue,
        },
      })
    )
    .exhaustive();
}

export function invalidResult(
  issues: RiskAnalysisValidationIssue[]
): RiskAnalysisValidationInvalid {
  return {
    type: "invalid",
    issues,
  };
}

export function validResult<T>(value: T): RiskAnalysisValidationResult<T> {
  return {
    type: "valid",
    value,
  };
}
