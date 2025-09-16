import {
  PurposeTemplate,
  purposeTemplateState,
  PurposeTemplateState,
  RiskAnalysisFormTemplate,
  TenantKind,
} from "pagopa-interop-models";
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
  missingFreeOfChargeReason,
  purposeTemplateNameConflict,
  purposeTemplateNotInExpectedState,
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
  riskAnalysisFormTemplate:
    | purposeTemplateApi.RiskAnalysisFormTemplateSeed
    | undefined,
  tenantKind: TenantKind
): RiskAnalysisFormTemplate | undefined {
  if (!riskAnalysisFormTemplate) {
    return undefined;
  }

  const validatedForm = validateRiskAnalysisTemplateOrThrow({
    riskAnalysisFormTemplate,
    tenantKind,
  });

  return riskAnalysisValidatedFormTemplateToNewRiskAnalysisFormTemplate(
    validatedForm
  );
}

export function validateRiskAnalysisTemplateOrThrow({
  riskAnalysisFormTemplate,
  tenantKind,
}: {
  riskAnalysisFormTemplate: purposeTemplateApi.RiskAnalysisFormTemplateSeed;
  tenantKind: TenantKind;
}): RiskAnalysisTemplateValidatedForm {
  const result = validatePurposeTemplateRiskAnalysis(
    riskAnalysisFormTemplate,
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
  creatorId: string,
  authData: Pick<UIAuthData | M2MAdminAuthData, "organizationId">
): void => {
  if (authData.organizationId !== creatorId) {
    throw tenantNotAllowed(authData.organizationId);
  }
};

export const assertActivatableState = (
  purposeTemplate: PurposeTemplate,
  allowedState: PurposeTemplateState
): void => {
  if (purposeTemplate.state !== allowedState) {
    throw purposeTemplateNotInExpectedState(
      purposeTemplate.id,
      purposeTemplate.state,
      allowedState
    );
  }
};

export const assertSuspendableState = (
  purposeTemplate: PurposeTemplate
): void => {
  const expectedState = purposeTemplateState.active;

  if (purposeTemplate.state !== expectedState) {
    throw purposeTemplateNotInExpectedState(
      purposeTemplate.id,
      purposeTemplate.state,
      expectedState
    );
  }
};
