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
  M2MAuthData,
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
  purposeTemplateStateConflict,
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
  allowedInitialState: PurposeTemplateState
): void => {
  match(purposeTemplate)
    .when(
      (p) => p.state === purposeTemplateState.active,
      () => {
        throw purposeTemplateStateConflict(
          purposeTemplate.id,
          purposeTemplate.state
        );
      }
    )
    .when(
      (p) => p.state === allowedInitialState,
      () => undefined
    )
    .otherwise(() => {
      throw purposeTemplateNotInExpectedState(
        purposeTemplate.id,
        purposeTemplate.state,
        allowedInitialState
      );
    });
};

export const assertRequesterCanRetrievePurposeTemplate = async (
  purposeTemplate: PurposeTemplate,
  authData: Pick<UIAuthData | M2MAuthData | M2MAdminAuthData, "organizationId">
): Promise<void> => {
  if (
    purposeTemplate.state !== purposeTemplateState.active &&
    purposeTemplate.creatorId !== authData.organizationId
  ) {
    throw tenantNotAllowed(authData.organizationId);
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
