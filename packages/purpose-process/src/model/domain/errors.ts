import {
  ApiError,
  EServiceId,
  EServiceMode,
  PurposeId,
  PurposeVersionDocumentId,
  PurposeVersionId,
  PurposeVersionState,
  RiskAnalysisId,
  TenantId,
  TenantKind,
  makeApiProblemBuilder,
} from "pagopa-interop-models";
import { RiskAnalysisValidationIssue, logger } from "pagopa-interop-commons";

export const errorCodes = {
  purposeNotFound: "0001",
  eserviceNotFound: "0002",
  tenantNotFound: "0003",
  tenantKindNotFound: "0004",
  purposeVersionNotFound: "0005",
  purposeVersionDocumentNotFound: "0006",
  organizationNotAllowed: "0007",
  organizationIsNotTheConsumer: "0008",
  purposeVersionCannotBeDeleted: "0009",
  organizationIsNotTheProducer: "0010",
  notValidVersionState: "0011",
  missingRejectionReason: "0012",
  eServiceModeNotAllowed: "0013",
  missingFreeOfChargeReason: "0014",
  riskAnalysisValidationFailed: "0015",
  purposeNotInDraftState: "0016",
  duplicatedPurposeTitle: "0017",
  purposeCannotBeDeleted: "0018",
  agreementNotFound: "0019",
  eserviceRiskAnalysisNotFound: "0020",
  purposeCannotBeCloned: "0021",
  riskAnalysisConfigVersionNotFound: "0022",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(logger, errorCodes);

export function purposeNotFound(purposeId: PurposeId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose ${purposeId} not found`,
    code: "purposeNotFound",
    title: "Purpose not found",
  });
}

export function eserviceNotFound(eserviceId: EServiceId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eserviceId} not found`,
    code: "eserviceNotFound",
    title: "EService not found",
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

export function purposeVersionNotFound(
  purposeId: PurposeId,
  versionId: PurposeVersionId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Version ${versionId} not found for purpose ${purposeId}`,
    code: "purposeVersionNotFound",
    title: "Purpose version not found",
  });
}

export function purposeVersionDocumentNotFound(
  purposeId: PurposeId,
  versionId: PurposeVersionId,
  documentId: PurposeVersionDocumentId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Document ${documentId} not found for version ${versionId} of purpose ${purposeId}`,
    code: "purposeVersionDocumentNotFound",
    title: "Purpose version document not found",
  });
}

export function organizationNotAllowed(
  organizationId: TenantId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organization ${organizationId} is not allowed to perform the operation`,
    code: "organizationNotAllowed",
    title: "Organization not allowed",
  });
}

export function organizationIsNotTheConsumer(
  organizationId: TenantId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organization ${organizationId} is not allowed to perform the operation`,
    code: "organizationIsNotTheConsumer",
    title: "Organization not allowed",
  });
}

export function purposeVersionCannotBeDeleted(
  purposeId: PurposeId,
  versionId: PurposeVersionId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Version ${versionId} of Purpose ${purposeId} cannot be deleted`,
    code: "purposeVersionCannotBeDeleted",
    title: "Purpose version canont be deleted",
  });
}

export function organizationIsNotTheProducer(
  organizationId: TenantId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Organization ${organizationId} is not allowed to perform the operation`,
    code: "organizationIsNotTheProducer",
    title: "Organization not allowed",
  });
}

export function eServiceModeNotAllowed(
  eserviceId: EServiceId,
  mode: EServiceMode
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eserviceId} has not ${mode} mode`,
    code: "eServiceModeNotAllowed",
    title: "EService mode not allowed",
  });
}

export function missingFreeOfChargeReason(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "Missing free of charge reason",
    code: "missingFreeOfChargeReason",
    title: "Missing free of charge reason",
  });
}

export function riskAnalysisValidationFailed(
  reasons: RiskAnalysisValidationIssue[]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Risk analysis validation failed. Reasons: ${reasons}`,
    code: "riskAnalysisValidationFailed",
    title: "Risk analysis validation failed",
  });
}

export function purposeNotInDraftState(
  purposeId: PurposeId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose ${purposeId} is not in draft state`,
    code: "purposeNotInDraftState",
    title: "Purpose not in draft state",
  });
}

export function notValidVersionState(
  purposeVersionId: PurposeVersionId,
  versionState: PurposeVersionState
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose version ${purposeVersionId} has a not valid state for this operation: ${versionState}`,
    code: "notValidVersionState",
    title: "Not valid purpose version state",
  });
}

export function missingRejectionReason(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Rejection reason is missing`,
    code: "missingRejectionReason",
    title: "Rejection reason can't be omitted",
  });
}

export function duplicatedPurposeTitle(title: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose with title: ${title} already exists`,
    code: "duplicatedPurposeTitle",
    title: "Duplicated Purpose Title",
  });
}

export function purposeCannotBeDeleted(
  purposeId: PurposeId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Versions in Purpose ${purposeId} do not allow deletion`,
    code: "purposeCannotBeDeleted",
    title: "Purpose cannot be deleted",
  });
}

export function agreementNotFound(
  eserviceId: EServiceId,
  consumerId: TenantId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `No Agreement found for EService ${eserviceId} and Consumer ${consumerId}`,
    code: "agreementNotFound",
    title: "Agreement Not Found",
  });
}

export function eserviceRiskAnalysisNotFound(
  eserviceId: EServiceId,
  riskAnalysisId: RiskAnalysisId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Risk Analysis ${riskAnalysisId} not found for EService ${eserviceId}`,
    code: "eserviceRiskAnalysisNotFound",
    title: "Risk analysis not found",
  });
}

export function purposeCannotBeCloned(
  purposeId: PurposeId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose ${purposeId} cannot be cloned`,
    code: "purposeCannotBeCloned",
    title: "Purpose cannot be cloned",
  });
}

export function RiskAnalysisConfigVersionNotFound(
  version: string,
  tenantKind: TenantKind
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Risk Analysis Configuration version ${version} for tenant kind ${tenantKind} not found`,
    code: "riskAnalysisConfigVersionNotFound",
    title: "Risk Analysis config version not found",
  });
}
