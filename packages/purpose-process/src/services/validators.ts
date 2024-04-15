import {
  EServiceId,
  EServiceMode,
  Purpose,
  RiskAnalysisForm,
  Tenant,
  TenantId,
  TenantKind,
  purposeVersionState,
} from "pagopa-interop-models";
import {
  validateRiskAnalysis,
  riskAnalysisFormToRiskAnalysisFormToValidate,
  RiskAnalysisValidatedForm,
} from "pagopa-interop-commons";
import {
  eServiceModeNotAllowed,
  missingFreeOfChargeReason,
  organizationIsNotTheConsumer,
  purposeNotInDraftState,
  riskAnalysisValidationFailed,
  tenantKindNotFound,
} from "../model/domain/errors.js";
import { RiskAnalysisFormSeed } from "../model/domain/models.js";

export const isEserviceMode = (
  eserviceId: EServiceId,
  mode: EServiceMode
): void => {
  if (mode !== mode) {
    throw eServiceModeNotAllowed(eserviceId, mode);
  }
};

export const purposeIsDraft = (purpose: Purpose): boolean =>
  !purpose.versions.some((v) => v.state !== purposeVersionState.draft);

export const isRiskAnalysisFormValid = (
  riskAnalysisForm: RiskAnalysisForm | undefined,
  schemaOnlyValidation: boolean,
  tenantKind: TenantKind
): boolean => {
  if (riskAnalysisForm === undefined) {
    return false;
  } else {
    return (
      validateRiskAnalysis(
        riskAnalysisFormToRiskAnalysisFormToValidate(riskAnalysisForm),
        schemaOnlyValidation,
        tenantKind
      ).type === "valid"
    );
  }
};

export const isFreeOfCharge = (
  isFreeOfCharge: boolean,
  freeOfChargeReason: string | undefined
): void => {
  if (isFreeOfCharge && !freeOfChargeReason) {
    throw missingFreeOfChargeReason();
  }
};

export const assertOrganizationIsAConsumer = (
  organizationId: TenantId,
  consumerId: TenantId
): void => {
  if (organizationId !== consumerId) {
    throw organizationIsNotTheConsumer(organizationId);
  }
};

export function validateRiskAnalysisSchemaOrThrow(
  riskAnalysisForm: RiskAnalysisFormSeed,
  tenantKind: TenantKind
): RiskAnalysisValidatedForm {
  const result = validateRiskAnalysis(riskAnalysisForm, true, tenantKind);
  if (result.type === "invalid") {
    throw riskAnalysisValidationFailed(result.issues);
  } else {
    return result.value;
  }
}

export function assertTenantKindExists(
  tenant: Tenant
): asserts tenant is Tenant & { kind: NonNullable<Tenant["kind"]> } {
  if (!tenant.kind) {
    throw tenantKindNotFound(tenant.id);
  }
}

export function assertIsDraft(purpose: Purpose): void {
  if (!purposeIsDraft(purpose)) {
    throw purposeNotInDraftState(purpose.id);
  }
}
