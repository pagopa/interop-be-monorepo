import {
  ApiError,
  AttributeId,
  makeApiProblemBuilder,
} from "pagopa-interop-models";

export const errorCodes = {
  purposeNotFound: "0001",
  userNotFound: "0002",
  selfcareEntityNotFilled: "0003",
  descriptorNotFound: "0004",
  attributeNotExists: "0005",
  invalidEserviceRequester: "0006",
  missingClaim: "0007",
  tenantLoginNotAllowed: "0008",
  tokenVerificationFailed: "0009",
  eServiceNotFound: "0010",
  tenantNotFound: "0011",
  agreementNotFound: "0012",
  eserviceDescriptorNotFound: "0013",
  purposeDraftVersionNotFound: "0014",
  invalidRiskAnalysisContentType: "0015",
  missingInterface: "0016",
  eserviceRiskNotFound: "0017",
  missingDescriptorInClonedEservice: "0018",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function selfcareEntityNotFilled(
  className: string,
  field: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Selfcare entity ${className} with field ${field} not filled`,
    code: "selfcareEntityNotFilled",
    title: "Selfcare Entity not filled",
  });
}

export function userNotFound(
  userId: string,
  selfcareId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `User ${userId} not found for institution ${selfcareId}`,
    code: "userNotFound",
    title: "User not found",
  });
}

export function purposeNotFound(purposeId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose ${purposeId} not found`,
    code: "purposeNotFound",
    title: "Purpose not found",
  });
}

export function eServiceNotFound(eserviceId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eserviceId} not found`,
    code: "eServiceNotFound",
    title: "EService not found",
  });
}

export function tenantNotFound(tenantId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant ${tenantId} not found`,
    code: "tenantNotFound",
    title: "Tenant not found",
  });
}

export function agreementNotFound(consumerId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Agreement of consumer ${consumerId} not found`,
    code: "agreementNotFound",
    title: "Agreement not found",
  });
}

export function eserviceDescriptorNotFound(
  eserviceId: string,
  descriptorId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor ${descriptorId} not found in Eservice ${eserviceId}`,
    code: "eserviceDescriptorNotFound",
    title: "EService descriptor not found",
  });
}

export function purposeDraftVersionNotFound(
  purposeId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Version in DRAFT state for Purpose ${purposeId} not found`,
    code: "purposeDraftVersionNotFound",
    title: "Purpose draft version not found",
  });
}

export function invalidEServiceRequester(
  eserviceId: string,
  requesterId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eserviceId} does not belong to producer ${requesterId}`,
    code: "invalidEserviceRequester",
    title: `Invalid eservice requester`,
  });
}

export function attributeNotExists(id: AttributeId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attribute ${id} does not exist in the attribute registry`,
    code: "attributeNotExists",
    title: "Attribute not exists",
  });
}

export function missingClaim(claimName: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Claim ${claimName} has not been passed`,
    code: "missingClaim",
    title: "Claim not found",
  });
}

export function tenantLoginNotAllowed(
  selfcareId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant origin is not allowed and SelfcareID ${selfcareId} does not belong to allow list`,
    code: "tenantLoginNotAllowed",
    title: "Tenant login not allowed",
  });
}

export function tokenVerificationFailed(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "Token verification failed",
    code: "tokenVerificationFailed",
    title: "Token verification failed",
  });
}

export function invalidRiskAnalysisContentType(
  contentType: string,
  purposeId: string,
  versionId: string,
  documentId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Invalid contentType ${contentType} for document ${documentId} from purpose ${purposeId} and version ${versionId}`,
    code: "invalidRiskAnalysisContentType",
    title: "Invalid Risk Analysis content type",
  });
}

export function missingInterface(
  eserviceId: string,
  descriptorId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Missing interface for Eservice ${eserviceId} and descriptor ${descriptorId}`,
    code: "missingInterface",
    title: "Missing interface",
  });
}

export function eserviceRiskNotFound(
  eserviceId: string,
  riskAnalysisId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `"RiskAnalysis ${riskAnalysisId} not found in Eservice ${eserviceId}"`,
    code: "eserviceRiskNotFound",
    title: "Risk analysis not found",
  });
}

export function missingDescriptorInClonedEservice(
  eserviceId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Missing descriptor in cloned eService ${eserviceId}`,
    code: "missingDescriptorInClonedEservice",
    title: "Missing descriptor in cloned eService",
  });
}
