import { TenantKind } from "pagopa-interop-models";
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
  missingExpectedFieldError,
  noRulesVersionFoundError,
  unexpectedDependencyValueError,
  unexpectedFieldError,
  unexpectedFieldFormatError,
  unexpectedFieldValue,
  unexpectedRulesVersionError,
} from "./riskAnalysisErrors.js";
import {
  FormQuestionRules,
  RiskAnalysisFormRules,
  dataType,
} from "./rules/models.js";
import { riskAnalysisFormRules } from "./rules/riskAnalysisFormRules.js";

export function validateRiskAnalysis(
  riskAnalysisForm: RiskAnalysisFormToValidate,
  schemaOnlyValidation: boolean,
  tenantKind: TenantKind
): RiskAnalysisValidationResult<RiskAnalysisValidatedForm> {
  const latestVersionFormRules = getLatestVersionFormRules(tenantKind);

  if (latestVersionFormRules === undefined) {
    return invalidResult([noRulesVersionFoundError(tenantKind)]);
  }

  if (latestVersionFormRules.version !== riskAnalysisForm.version) {
    return invalidResult([
      unexpectedRulesVersionError(riskAnalysisForm.version),
    ]);
  }

  const validationRules = latestVersionFormRules.questions.map(
    questionRulesToValidationRule
  );

  const sanitizedAnswers = Object.fromEntries(
    Object.entries(riskAnalysisForm.answers).filter(([, v]) => v.length > 0)
  );

  const results = validateFormAnswers(
    sanitizedAnswers,
    schemaOnlyValidation,
    validationRules
  );

  if (results.some((r) => r.type === "invalid" && r.issues.length > 0)) {
    return invalidResult(
      results.flatMap((r) => (r.type === "invalid" ? r.issues : []))
    );
  } else {
    const validatedAnswers = results.flatMap((r) =>
      r.type === "valid" ? [r.value] : []
    );

    const { singleAnswers, multiAnswers } = validatedAnswers.reduce(
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

    return validResult({
      version: latestVersionFormRules.version,
      singleAnswers,
      multiAnswers,
    });
  }
}

function getLatestVersionFormRules(
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

function questionRulesDepsToValidationRuleDeps(
  dependencies: FormQuestionRules["dependencies"]
): ValidationRuleDependency[] {
  return dependencies.map((d) => ({
    fieldName: d.id,
    fieldValue: d.value,
  }));
}

function questionRulesToValidationRule(
  question: FormQuestionRules
): ValidationRule {
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
        .with(false, () =>
          invalidResult(validateRequiredFields(answers, validationRules))
        )
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
          : [unexpectedFieldValue(rule.fieldName, allowedValues)]
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
  return [
    ...(dependencyValue === undefined
      ? [dependencyNotFoundError(dependentField, dependency.fieldName)]
      : []),
    ...(dependencyValue !== undefined &&
    !dependencyValue.some((v) => v === dependency.fieldValue)
      ? [
          unexpectedDependencyValueError(
            dependentField,
            dependency.fieldName,
            dependency.fieldValue
          ),
        ]
      : []),
  ];
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

function invalidResult(
  issues: RiskAnalysisValidationIssue[]
): RiskAnalysisValidationInvalid {
  return {
    type: "invalid",
    issues,
  };
}

function validResult<T>(value: T): RiskAnalysisValidationResult<T> {
  return {
    type: "valid",
    value,
  };
}
