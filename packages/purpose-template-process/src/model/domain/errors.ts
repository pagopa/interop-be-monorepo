import {
  PurposeTemplateValidationIssue,
  RiskAnalysisTemplateValidationIssue,
} from "pagopa-interop-commons";
import {
  ApiError,
  EServiceId,
  makeApiProblemBuilder,
  PurposeTemplateId,
} from "pagopa-interop-models";

export const errorCodes = {
  missingFreeOfChargeReason: "0001",
  purposeTemplateNameConflict: "0002",
  purposeTemplateNotFound: "0003",
  riskAnalysisTemplateValidationFailed: "0004",
  associationEServicesForPurposeTemplateFailed: "0005",
  tooManyEServicesForPurposeTemplate: "0006",
  missingExpectedEService: "0007",
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

export function associationEServicesForPurposeTemplateFailed(
  reasons: PurposeTemplateValidationIssue[],
  eserviceIds: EServiceId[],
  purposeTemplateId: PurposeTemplateId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Association of e-services to purpose template failed. Reasons: ${reasons} Eservices: ${eserviceIds} Purpose template: ${purposeTemplateId}`,
    code: "associationEServicesForPurposeTemplateFailed",
    title: "Association of e-services to purpose template failed",
  });
}

export function tooManyEServicesForPurposeTemplate(
  actualCount: number,
  maxCount: number
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Too many e-services provided. Maximum allowed: ${maxCount}, provided: ${actualCount}`,
    code: "tooManyEServicesForPurposeTemplate",
    title: "Too Many E-Services for Purpose Template",
  });
}
