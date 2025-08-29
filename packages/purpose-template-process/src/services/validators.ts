import {
  PurposeTemplate,
  purposeTemplateState,
  RiskAnalysisFormTemplate,
  TenantKind,
} from "pagopa-interop-models";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  riskAnalysisFormTemplateToRiskAnalysisFormTemplateToValidate,
  RiskAnalysisTemplateValidatedForm,
  riskAnalysisValidatedFormTemplateToNewRiskAnalysisFormTemplate,
  UIAuthData,
  validatePurposeTemplateRiskAnalysis,
} from "pagopa-interop-commons";
import {
  missingFreeOfChargeReason,
  purposeTemplateNameConflict,
  riskAnalysisTemplateValidationFailed,
} from "../model/domain/errors.js";
import { tenantNotAllowed } from "../model/errors.js";
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

  const validatedForm = validateRiskAnalysisTemplateOrThrow({
    riskAnalysisForm: purposeRiskAnalysisForm,
    tenantKind,
  });

  return riskAnalysisValidatedFormTemplateToNewRiskAnalysisFormTemplate(
    validatedForm
  );
}

export function validateRiskAnalysisTemplateOrThrow({
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

export const isRiskAnalysisTemplateValid = (
  riskAnalysisFormTemplate: RiskAnalysisFormTemplate | undefined,
  tenantKind: TenantKind
): boolean => {
  if (riskAnalysisFormTemplate === undefined) {
    return false;
  } else {
    return (
      validatePurposeTemplateRiskAnalysis(
        riskAnalysisFormTemplateToRiskAnalysisFormTemplateToValidate(
          riskAnalysisFormTemplate
        ),
        tenantKind
      ).type === "valid"
    );
  }
};

export const assertRequesterCanRetrievePurposeTemplate = async (
  purposeTemplate: PurposeTemplate,
  authData: Pick<UIAuthData, "organizationId">
): Promise<void> => {
  if (
    purposeTemplate.state === purposeTemplateState.draft &&
    purposeTemplate.creatorId !== authData.organizationId
  ) {
    throw tenantNotAllowed(authData.organizationId);
  }
};
