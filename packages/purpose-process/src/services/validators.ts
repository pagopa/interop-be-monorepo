import {
  riskAnalysisFormToRiskAnalysisFormToValidate,
  validateRiskAnalysis,
} from "pagopa-interop-commons";
import {
  Purpose,
  PurposeVersion,
  RiskAnalysisForm,
  TenantKind,
  purposeVersionState,
} from "pagopa-interop-models";

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

export const purposeIsDraft = (purpose: Purpose): boolean =>
  !purpose.versions.some((v) => v.state !== purposeVersionState.draft);

export const isDeletableVersion = (
  purposeVersion: PurposeVersion,
  purpose: Purpose
): boolean =>
  purposeVersion.state === purposeVersionState.waitingForApproval &&
  purpose.versions.length !== 1;
