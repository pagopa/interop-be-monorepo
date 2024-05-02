import {
  ApiError,
  DescriptorId,
  EServiceId,
  EServiceMode,
  PurposeId,
  PurposeVersionDocumentId,
  PurposeVersionId,
  PurposeVersionState,
  TenantId,
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
  purposeCannotBeDeleted: "0017",
  unchangedDailyCalls: "0018",
  agreementNotFound: "0019",
  descriptorNotFound: "0020",
  missingRiskAnalysis: "0021",
  duplicatedPurposeTitle: "0022",
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

export function agreementNotFound(
  eserviceId: EServiceId,
  consumerId: TenantId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Agreement not found for EService ${eserviceId} and consumer ${consumerId}`,
    code: "agreementNotFound",
    title: "Agreement not found",
  });
}

export function descriptorNotFound(
  eserviceId: EServiceId,
  descriptorId: DescriptorId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor ${descriptorId} not found for eservice ${eserviceId}`,
    code: "descriptorNotFound",
    title: "Descriptor not found",
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

export function missingRiskAnalysis(
  purposeId: PurposeId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose ${purposeId} must contain a valid risk analysis`,
    code: "missingRiskAnalysis",
    title: "Missing risk analysis",
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

export function unchangedDailyCalls(
  purposeId: PurposeId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Creation of new version without changing daily calls for purpose ${purposeId}`,
    code: "unchangedDailyCalls",
    title: "Unchanged daily calls",
  });
}
