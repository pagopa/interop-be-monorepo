import {
  PurposeTemplate,
  purposeTemplateState,
  PurposeTemplateState,
  RiskAnalysisFormTemplate,
  TenantId,
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
  purposeTemplateNotInExpectedStates,
  purposeTemplateRiskAnalysisFormNotFound,
  purposeTemplateStateConflict,
  riskAnalysisTemplateValidationFailed,
  tenantNotAllowed,
} from "../model/domain/errors.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";

const isRequesterCreator = (
  creatorId: TenantId,
  authData: Pick<UIAuthData | M2MAuthData | M2MAdminAuthData, "organizationId">
): boolean => authData.organizationId === creatorId;

const isPurposeTemplateActive = (
  currentPurposeTemplateState: PurposeTemplateState
): boolean => currentPurposeTemplateState === purposeTemplateState.active;

const isPurposeTemplateArchived = (
  currentPurposeTemplateState: PurposeTemplateState
): boolean => currentPurposeTemplateState === purposeTemplateState.archived;

const isPurposeTemplateDraft = (
  currentPurposeTemplateState: PurposeTemplateState
): boolean => currentPurposeTemplateState === purposeTemplateState.draft;

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

export const assertPurposeTemplateIsDraft = (
  purposeTemplate: PurposeTemplate
): void => {
  if (!isPurposeTemplateDraft(purposeTemplate.state)) {
    throw purposeTemplateNotInExpectedStates(
      purposeTemplate.id,
      purposeTemplate.state,
      [purposeTemplateState.draft]
    );
  }
};

export const assertRequesterIsCreator = (
  creatorId: TenantId,
  authData: Pick<UIAuthData | M2MAdminAuthData, "organizationId">
): void => {
  if (!isRequesterCreator(creatorId, authData)) {
    throw tenantNotAllowed(authData.organizationId);
  }
};

export const assertRequesterCanRetrievePurposeTemplate = async (
  purposeTemplate: PurposeTemplate,
  authData: Pick<UIAuthData | M2MAuthData | M2MAdminAuthData, "organizationId">
): Promise<void> => {
  if (
    !isPurposeTemplateActive(purposeTemplate.state) &&
    !isRequesterCreator(purposeTemplate.creatorId, authData)
  ) {
    throw tenantNotAllowed(authData.organizationId);
  }
};

export const assertPurposeTemplateStateIsValid = (
  purposeTemplate: PurposeTemplate,
  expectedInitialStates: PurposeTemplateState[],
  conflictState?: PurposeTemplateState
): void => {
  match(purposeTemplate)
    .when(
      (p) => p.state === conflictState,
      () => {
        throw purposeTemplateStateConflict(
          purposeTemplate.id,
          purposeTemplate.state
        );
      }
    )
    .when(
      (p) => !expectedInitialStates.includes(p.state),
      () => {
        throw purposeTemplateNotInExpectedStates(
          purposeTemplate.id,
          purposeTemplate.state,
          expectedInitialStates
        );
      }
    );
};

export const assertActivatableState = (
  purposeTemplate: PurposeTemplate,
  expectedInitialState: PurposeTemplateState
): void => {
  assertPurposeTemplateStateIsValid(
    purposeTemplate,
    [expectedInitialState],
    purposeTemplateState.active
  );
};

export const assertSuspendableState = (
  purposeTemplate: PurposeTemplate
): void => {
  assertPurposeTemplateStateIsValid(
    purposeTemplate,
    [purposeTemplateState.active],
    purposeTemplateState.suspended
  );
};

export const archivableInitialStates = Object.values(
  purposeTemplateState
).filter((state) => !isPurposeTemplateArchived(state));
export const assertArchivableState = (
  purposeTemplate: PurposeTemplate
): void => {
  assertPurposeTemplateStateIsValid(
    purposeTemplate,
    archivableInitialStates,
    purposeTemplateState.archived
  );
};

export function assertPurposeTemplateHasRiskAnalysisForm(
  purposeTemplate: PurposeTemplate
): void {
  if (!purposeTemplate.purposeRiskAnalysisForm) {
    throw purposeTemplateRiskAnalysisFormNotFound(purposeTemplate.id);
  }
}
