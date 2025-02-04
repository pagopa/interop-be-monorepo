import { RiskAnalysisValidationIssue } from "pagopa-interop-commons";
import {
  ApiError,
  EServiceTemplateId,
  EServiceTemplateVersionId,
  EServiceTemplateVersionState,
  makeApiProblemBuilder,
  TenantId,
} from "pagopa-interop-models";

export const errorCodes = {
  eServiceTemplateNotFound: "0001",
  eServiceTemplateVersionNotFound: "0002",
  notValidEServiceTemplateVersionState: "0003",
  eServiceTemplateDuplicate: "0004",
  eserviceTemplateWithoutPublishedVersion: "0005",
  requesterIsNotCreator: "0006",
  riskAnalysisNameDuplicate: "0007",
  riskAnalysisValidationFailed: "0008",
  tenantNotFound: "0009",
  tenantKindNotFound: "0010",
  eserviceTemplateNotInDraftState: "0011",
  eserviceTemplateNotInReceiveMode: "0012",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function eServiceTemplateNotFound(
  eserviceTemplateId: EServiceTemplateId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService Template ${eserviceTemplateId} not found`,
    code: "eServiceTemplateNotFound",
    title: "EService Template not found",
  });
}

export function eServiceTemplateVersionNotFound(
  eserviceTemplateId: EServiceTemplateId,
  eserviceTemplateVersionId: EServiceTemplateVersionId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService Template ${eserviceTemplateId} version ${eserviceTemplateVersionId} not found`,
    code: "eServiceTemplateVersionNotFound",
    title: "EService Template version not found",
  });
}

export function notValidEServiceTemplateVersionState(
  eserviceTemplateVersionId: EServiceTemplateVersionId,
  eserviceTemplateVersionState: EServiceTemplateVersionState
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService template version ${eserviceTemplateVersionId} has a not valid status for this operation ${eserviceTemplateVersionState}`,
    code: "notValidEServiceTemplateVersionState",
    title: "Not valid eservice template version state",
  });
}

export function eServiceTemplateDuplicate(
  eserviceTemplateName: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `An EService Template with name ${eserviceTemplateName} already exists`,
    code: "eServiceTemplateDuplicate",
    title: "Duplicated service name",
  });
}

export function eserviceTemplateWithoutPublishedVersion(
  eserviceTemplateId: EServiceTemplateId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService Template ${eserviceTemplateId} does not have a published version`,
    code: "eserviceTemplateWithoutPublishedVersion",
    title: "EService template without published version",
  });
}

export function eserviceTemplateRequesterIsNotCreator(
  eserviceTemplateId: EServiceTemplateId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Requester is not the creator of the EService Template ${eserviceTemplateId}`,
    code: "requesterIsNotCreator",
    title: "Requester is not the creator",
  });
}

export function eserviceTemaplateRiskAnalysisNameDuplicate(
  riskAnalysisName: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Risk analysis with name ${riskAnalysisName} already exists`,
    code: "riskAnalysisNameDuplicate",
    title: "Risk analysis name duplicate",
  });
}

export function riskAnalysisValidationFailed(
  issues: RiskAnalysisValidationIssue[]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Risk analysis validation failed. Reasons: [${issues
      .map((i) => i.detail)
      .join(", ")}]`,
    code: "riskAnalysisValidationFailed",
    title: "Risk analysis validation failed",
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

export function templateNotInDraftState(
  templateId: EServiceTemplateId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService template ${templateId} is not in draft state`,
    code: "eserviceTemplateNotInDraftState",
    title: "EService Template is not in draft state",
  });
}

export function templateNotInReceiveMode(
  templateId: EServiceTemplateId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService Template ${templateId} is not in receive mode`,
    code: "eserviceTemplateNotInReceiveMode",
    title: "EService Template is not in receive mode",
  });
}
