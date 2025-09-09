import { RiskAnalysisFormTemplate, TenantKind } from "pagopa-interop-models";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  RiskAnalysisTemplateValidatedForm,
  riskAnalysisValidatedFormTemplateToNewRiskAnalysisFormTemplate,
  validatePurposeTemplateRiskAnalysis,
} from "pagopa-interop-commons";
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
    throw purposeTemplateNameConflict(
      purposeTemplateWithSameName.data.id,
      purposeTemplateWithSameName.data.purposeTitle
    );
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

  const validatedForm = validateRiskAnalysisTemplateOrThrow({
    riskAnalysisForm: purposeRiskAnalysisForm,
    tenantKind,
  });

  return riskAnalysisValidatedFormTemplateToNewRiskAnalysisFormTemplate(
    validatedForm
  );
}

function validateRiskAnalysisTemplateOrThrow({
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
