import { TenantKind } from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  FormTemplateQuestion,
  RiskAnalysisFormTemplate,
  dataType,
  riskAnalysisTemplates,
} from "./riskAnalysisTemplates.js";
import {
  noTemplateVersionFoundError,
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

  const { singleAnswers, multiAnswers } = validateRiskAnalysisFormAnswers(
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

export function validateRiskAnalysisFormAnswers(
  riskAnalysisFormAnswers: RiskAnalysisFormToValidate["answers"],
  schemaOnlyValidation: boolean,
  validationRules: ValidationRule[]
): Omit<RiskAnalysisValidatedForm, "version"> {
  if (!schemaOnlyValidation) {
    validateExpectedFields(riskAnalysisFormAnswers, validationRules);
  }
  // TODO unmock
  return {
    singleAnswers: [],
    multiAnswers: [],
  };
}

export function validateExpectedFields(
  _riskAnalysisFormAnswers: RiskAnalysisFormToValidate["answers"],
  _validationRules: ValidationRule[]
): void {
  // mock implementation
  return undefined;
}
