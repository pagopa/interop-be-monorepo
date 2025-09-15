import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  M2MAdminAuthData,
  RiskAnalysisTemplateValidatedForm,
  riskAnalysisValidatedFormTemplateToNewRiskAnalysisFormTemplate,
  UIAuthData,
  validatePurposeTemplateRiskAnalysis,
} from "pagopa-interop-commons";
import { match } from "ts-pattern";
import {
  PurposeTemplate,
  purposeTemplateState,
  RiskAnalysisFormTemplate,
  TenantKind,
} from "pagopa-interop-models";
import {
  missingFreeOfChargeReason,
  purposeTemplateNameConflict,
  purposeTemplateNotInDraftState,
  riskAnalysisTemplateValidationFailed,
  tenantNotAllowed,
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

export const assertPurposeTemplateIsDraft = (
  purposeTemplate: PurposeTemplate
): void => {
  if (purposeTemplate.state !== purposeTemplateState.draft) {
    throw purposeTemplateNotInDraftState(purposeTemplate.id);
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

  return match(result)
    .with({ type: "invalid" }, ({ issues }) => {
      throw riskAnalysisTemplateValidationFailed(issues);
    })
    .with({ type: "valid" }, ({ value }) => value)
    .exhaustive();
}

export const assertRequesterIsCreator = (
  purposeTemplate: PurposeTemplate,
  authData: UIAuthData | M2MAdminAuthData
): void => {
  if (purposeTemplate.creatorId !== authData.organizationId) {
    throw tenantNotAllowed(authData.organizationId);
  }
};
