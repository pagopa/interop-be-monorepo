import { RiskAnalysisTemplateValidationIssue } from "pagopa-interop-commons";
import {
  ApiError,
  makeApiProblemBuilder,
  PurposeTemplateId,
  PurposeTemplateState,
  TenantId,
} from "pagopa-interop-models";

export const errorCodes = {
  missingFreeOfChargeReason: "0001",
  purposeTemplateNameConflict: "0002",
  purposeTemplateNotFound: "0003",
  riskAnalysisTemplateValidationFailed: "0004",
  tenantNotAllowed: "0005",
  purposeTemplateNotInExpectedState: "0006",
  missingRiskAnalysisFormTemplate: "0007",
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

export function tenantNotAllowed(tenantId: TenantId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant ${tenantId} is not allowed to perform the operation because it's not the creator`,
    code: "tenantNotAllowed",
    title: "Tenant not allowed",
  });
}

export function purposeTemplateNotInExpectedState(
  purposeTemplateId: PurposeTemplateId,
  currentState: PurposeTemplateState,
  expectedState: PurposeTemplateState
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose Template ${purposeTemplateId} not in expected state (current state: ${currentState}, expected state: ${expectedState})`,
    code: "purposeTemplateNotInExpectedState",
    title: "Purpose Template not in expected state",
  });
}

export function missingRiskAnalysisFormTemplate(
  purposeTemplateId: PurposeTemplateId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose Template ${purposeTemplateId} must contain a valid risk analysis form template`,
    code: "missingRiskAnalysisFormTemplate",
    title: "Missing risk analysis form template",
  });
}
