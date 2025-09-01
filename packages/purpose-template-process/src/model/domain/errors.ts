import { RiskAnalysisTemplateValidationIssue } from "pagopa-interop-commons";
import {
  ApiError,
  makeApiProblemBuilder,
  PurposeTemplateId,
  TenantId,
} from "pagopa-interop-models";

export const errorCodes = {
  missingFreeOfChargeReason: "0001",
  purposeTemplateNameConflict: "0002",
  purposeTemplateNotFound: "0003",
  riskAnalysisTemplateValidationFailed: "0004",
  tenantNotFound: "0005",
  tenantKindNotFound: "0006",
  tenantNotAllowed: "0007",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function missingFreeOfChargeReason(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "Missing free of charge reason",
    code: "missingFreeOfChargeReason",
    title: "Missing free of charge reason",
  });
}

export function purposeTemplateNameConflict(
  purposeTemplateId: PurposeTemplateId,
  name: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose Template name conflict for ID ${purposeTemplateId} and name ${name}`,
    code: "purposeTemplateNameConflict",
    title: "Purpose Template name conflict",
  });
}

export function purposeTemplateNotFound(
  purposeTemplateId: PurposeTemplateId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `No Purpose Template found for ID ${purposeTemplateId}`,
    code: "purposeTemplateNotFound",
    title: "Purpose Template Not Found",
  });
}

export function riskAnalysisTemplateValidationFailed(
  reasons: RiskAnalysisTemplateValidationIssue[]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Risk analysis template validation failed. Reasons: ${reasons}`,
    code: "riskAnalysisTemplateValidationFailed",
    title: "Risk analysis template validation failed",
  });
}

export function tenantNotFound(tenantId: TenantId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant ${tenantId} not found`,
    code: "tenantNotFound",
    title: "Tenant not found",
  });
}

export function tenantKindNotFound(tenantId: TenantId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant kind for tenant ${tenantId} not found`,
    code: "tenantKindNotFound",
    title: "Tenant kind not found",
  });
}

export function tenantNotAllowed(tenantId: TenantId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant ${tenantId} is not allowed to perform the operation because it's not the creator`,
    code: "tenantNotAllowed",
    title: "Tenant not allowed",
  });
}
