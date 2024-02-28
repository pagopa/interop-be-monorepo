import { TenantKind } from "pagopa-interop-models";

// Defining RiskAnalysisValidationError
type RiskAnalysisValidationError = {
  message: string;
};

export function noTemplateVersionFoundError(
  kind: TenantKind
): RiskAnalysisValidationError {
  return {
    message: `Template version for tenant kind ${kind} not found`,
  };
}

export function unexpectedTemplateVersionError(
  version: string
): RiskAnalysisValidationError {
  return {
    message: `Unexpected template version ${version}`,
  };
}
