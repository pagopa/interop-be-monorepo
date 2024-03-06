import {
  ApiError,
  DescriptorId,
  EServiceDocumentId,
  EServiceId,
  RiskAnalysisId,
  TenantId,
  makeApiProblemBuilder,
} from "pagopa-interop-models";
import { RiskAnalysisValidationIssue, logger } from "pagopa-interop-commons";

export const errorCodes = {
  eServiceDescriptorNotFound: "0001",
  eServiceDescriptorWithoutInterface: "0002",
  notValidDescriptor: "0003",
  eServiceDocumentNotFound: "0004",
  eServiceNotFound: "0005",
  draftDescriptorAlreadyExists: "0006",
  eServiceDuplicate: "007",
  originNotCompliant: "0008",
  attributeNotFound: "0009",
  inconsistentDailyCalls: "0010",
  interfaceAlreadyExists: "0011",
  eserviceNotInDraftState: "0012",
  eserviceNotInReceiveMode: "0013",
  tenantNotFound: "0014",
  tenantKindNotFound: "0015",
  riskAnalysisValidationFailed: "0016",
  eServiceRiskAnalysisNotFound: "0017",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(logger, errorCodes);

export function eServiceNotFound(eserviceId: EServiceId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eserviceId} not found`,
    code: "eServiceNotFound",
    title: "EService not found",
  });
}

export function eServiceDuplicate(eserviceName: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `An EService with name ${eserviceName} already exists`,
    code: "eServiceDuplicate",
    title: "Duplicated service name",
  });
}

export function eServiceDescriptorNotFound(
  eserviceId: EServiceId,
  descriptorId: DescriptorId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor ${descriptorId} for EService ${eserviceId} not found`,
    code: "eServiceDescriptorNotFound",
    title: "EService descriptor not found",
  });
}

export function eServiceDocumentNotFound(
  eserviceId: EServiceId,
  descriptorId: DescriptorId,
  documentId: EServiceDocumentId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Document with id ${documentId} not found in EService ${eserviceId} / Descriptor ${descriptorId}`,
    code: "eServiceDocumentNotFound",
    title: "EService document not found",
  });
}

export function notValidDescriptor(
  descriptorId: DescriptorId,
  descriptorStatus: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor ${descriptorId} has a not valid status for this operation ${descriptorStatus}`,
    code: "notValidDescriptor",
    title: "Not valid descriptor",
  });
}

export function eServiceDescriptorWithoutInterface(
  descriptorId: DescriptorId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor ${descriptorId} does not have an interface`,
    code: "eServiceDescriptorWithoutInterface",
    title: "Not valid descriptor",
  });
}

export function draftDescriptorAlreadyExists(
  eserviceId: EServiceId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eserviceId} already contains a draft descriptor`,
    code: "draftDescriptorAlreadyExists",
    title: "EService already contains a draft descriptor",
  });
}

export function invalidDescriptorVersion(
  details: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: details,
    code: "notValidDescriptor",
    title: "Version is not a valid descriptor version",
  });
}

export function interfaceAlreadyExists(
  descriptorId: DescriptorId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor ${descriptorId} already contains an interface`,
    code: "interfaceAlreadyExists",
    title: "Descriptor already contains an interface",
  });
}

export function attributeNotFound(attributeId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attribute ${attributeId} not found`,
    code: "attributeNotFound",
    title: "Attribute not found",
  });
}

export function inconsistentDailyCalls(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `dailyCallsPerConsumer can't be greater than dailyCallsTotal`,
    code: "inconsistentDailyCalls",
    title: "Inconsistent daily calls",
  });
}

export function originNotCompliant(origin: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Requester has not origin ${origin}`,
    code: "originNotCompliant",
    title: "Origin is not compliant",
  });
}

export function eserviceNotInDraftState(
  eserviceId: EServiceId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eserviceId} is not in draft state`,
    code: "eserviceNotInDraftState",
    title: "EService is not in draft state",
  });
}

export function eserviceNotInReceiveMode(
  eserviceId: EServiceId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eserviceId} is not in receive mode`,
    code: "eserviceNotInReceiveMode",
    title: "EService is not in receive mode",
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

export function riskAnalysisValidationFailed(
  issues: RiskAnalysisValidationIssue[]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Risk analysis validation failed. Reasons: [${issues
      .map((i) => i.issue)
      .join(", ")}]`,
    code: "riskAnalysisValidationFailed",
    title: "Risk analysis validation failed",
  });
}

export function eServiceRiskAnalysisNotFound(
  eserviceId: EServiceId,
  riskAnalysisId: RiskAnalysisId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Risk Analysis ${riskAnalysisId} not found for EService ${eserviceId}`,
    code: "eServiceRiskAnalysisNotFound",
    title: "Risk analysis not found",
  });
}
