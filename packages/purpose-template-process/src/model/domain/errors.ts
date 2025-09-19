import { RiskAnalysisTemplateValidationIssue } from "pagopa-interop-commons";
import {
  ApiError,
  EServiceId,
  makeApiProblemBuilder,
  PurposeTemplateId,
  PurposeTemplateState,
} from "pagopa-interop-models";
import { PurposeTemplateValidationIssue } from "../../errors/purposeTemplateValidationErrors.js";

export const errorCodes = {
  missingFreeOfChargeReason: "0001",
  purposeTemplateNameConflict: "0002",
  purposeTemplateNotFound: "0003",
  riskAnalysisTemplateValidationFailed: "0004",
  associationEServicesForPurposeTemplateFailed: "0005",
  associationBetweenEServiceAndPurposeTemplateAlreadyExists: "0006",
  tooManyEServicesForPurposeTemplate: "0007",
  purposeTemplateNotInValidState: "0008",
  disassociationEServicesFromPurposeTemplateFailed: "0009",
  associationBetweenEServiceAndPurposeTemplateDoesNotExist: "0010",
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

export function associationBetweenEServiceAndPurposeTemplateAlreadyExists(
  reasons: PurposeTemplateValidationIssue[],
  eserviceIds: EServiceId[],
  purposeTemplateId: PurposeTemplateId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Association between e-services and purpose template failed. Reasons: ${reasons} Eservices: ${eserviceIds} Purpose template: ${purposeTemplateId}`,
    code: "associationBetweenEServiceAndPurposeTemplateAlreadyExists",
    title: "Association between e-service and purpose template already exists",
  });
}

export function disassociationEServicesFromPurposeTemplateFailed(
  reasons: PurposeTemplateValidationIssue[],
  eserviceIds: EServiceId[],
  purposeTemplateId: PurposeTemplateId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Disassociation of e-services from purpose template failed. Reasons: ${reasons} Eservices: ${eserviceIds} Purpose template: ${purposeTemplateId}`,
    code: "disassociationEServicesFromPurposeTemplateFailed",
    title: "Disassociation of e-services from purpose template failed",
  });
}

export function associationBetweenEServiceAndPurposeTemplateDoesNotExist(
  reasons: PurposeTemplateValidationIssue[],
  eserviceIds: EServiceId[],
  purposeTemplateId: PurposeTemplateId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Association between e-services and purpose template does not exist. Reasons: ${reasons} Eservices: ${eserviceIds} Purpose template: ${purposeTemplateId}`,
    code: "associationBetweenEServiceAndPurposeTemplateDoesNotExist",
    title: "Association between e-services and purpose template does not exist",
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

export function purposeTemplateNotInValidState(
  state: PurposeTemplateState,
  validStates: PurposeTemplateState[]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose template state is: ${state} but valid states are: ${validStates}`,
    code: "purposeTemplateNotInValidState",
    title: "Purpose template not in valid state",
  });
}
