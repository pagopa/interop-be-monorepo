import { RiskAnalysisValidationIssue } from "pagopa-interop-commons";
import {
  ApiError,
  AttributeId,
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
  riskAnalysisNameDuplicate: "0006",
  riskAnalysisValidationFailed: "0007",
  tenantNotFound: "0008",
  tenantKindNotFound: "0009",
  eserviceTemplateNotInDraftState: "0010",
  eserviceTemplateNotInReceiveMode: "0011",
  inconsistentDailyCalls: "0012",
  inconsistentAttributesSeedGroupsCount: "0013",
  versionAttributeGroupSupersetMissingInAttributesSeed: "0014",
  unchangedAttributes: "0015",
  attributeNotFound: "0016",
  originNotCompliant: "0017",
  invalidEServiceTemplateVersion: "0018",
  draftEServiceTemplateVersionAlreadyExists: "0019",
  missingTemplateVersionInterface: "0020",
  missingRiskAnalysis: "0021",
  interfaceAlreadyExists: "0022",
  prettyNameDuplicate: "0023",
  checksumDuplicate: "0024",
  eserviceTemplateDocumentNotFound: "0025",
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

export function originNotCompliant(origin: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Requester origin ${origin} is not allowed`,
    code: "originNotCompliant",
    title: "Origin is not compliant",
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

export function inconsistentDailyCalls(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `dailyCallsPerConsumer can't be greater than dailyCallsTotal`,
    code: "inconsistentDailyCalls",
    title: "Inconsistent daily calls",
  });
}

export function inconsistentAttributesSeedGroupsCount(
  eserviceTemplateId: EServiceTemplateId,
  eserviceTemplateVersionId: EServiceTemplateVersionId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attributes seed contains a different number of groups than the descriptor for EService template ${eserviceTemplateId} version ${eserviceTemplateVersionId}`,
    code: "inconsistentAttributesSeedGroupsCount",
    title: "Inconsistent attributes seed groups count",
  });
}

export function versionAttributeGroupSupersetMissingInAttributesSeed(
  eserviceTemplateId: EServiceTemplateId,
  eserviceTemplateVersionId: EServiceTemplateVersionId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Missing required attribute group superset in attributes seed for EService template ${eserviceTemplateId} version ${eserviceTemplateVersionId}`,
    code: "versionAttributeGroupSupersetMissingInAttributesSeed",
    title: "Descriptor attribute group superset missing in attributes seed",
  });
}

export function unchangedAttributes(
  eserviceTemplateId: EServiceTemplateId,
  eserviceTemplateVersionId: EServiceTemplateVersionId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `No new attributes detected in attribute seed for EService template ${eserviceTemplateId} version ${eserviceTemplateVersionId}`,
    code: "unchangedAttributes",
    title: "Unchanged attributes",
  });
}

export function attributeNotFound(
  attributeId: AttributeId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attribute ${attributeId} not found`,
    code: "attributeNotFound",
    title: "Attribute not found",
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

export function eserviceTemplateNotInDraftState(
  eserviceTemplateId: EServiceTemplateId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService Template ${eserviceTemplateId} is not in draft state`,
    code: "eserviceTemplateNotInDraftState",
    title: "EService Template not in draft state",
  });
}

export function invalidEServiceTemplateVersion(
  details: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: details,
    code: "invalidEServiceTemplateVersion",
    title: "Version is not a valid e-service template version",
  });
}

export function draftEServiceTemplateVersionAlreadyExists(
  eserviceTemplateId: EServiceTemplateId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Draft version for EService Template ${eserviceTemplateId} already exists`,
    code: "draftEServiceTemplateVersionAlreadyExists",
    title: "Draft version already exists",
  });
}

export function missingTemplateVersionInterface(
  templateId: EServiceTemplateId,
  versionId: EServiceTemplateVersionId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService template ${templateId} version ${versionId} is missing the interface document`,
    code: "missingTemplateVersionInterface",
    title: "Missing template version interface",
  });
}

export function missingRiskAnalysis(
  templateId: EServiceTemplateId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService template ${templateId} is missing the risk analysis`,
    code: "missingRiskAnalysis",
    title: "Missing risk analysis",
  });
}

export function interfaceAlreadyExists(
  interfaceName: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Interface ${interfaceName} already exists`,
    code: "interfaceAlreadyExists",
    title: "Interface already exists",
  });
}

export function prettyNameDuplicate(
  prettyName: string,
  eserviceTemplateVersionId: EServiceTemplateVersionId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `A document with prettyName ${prettyName} already exists in version ${eserviceTemplateVersionId}`,
    code: "prettyNameDuplicate",
    title: "Duplicated prettyName",
  });
}

export function checksumDuplicate(
  fileName: string,
  eserviceTemplateId: string,
  eserviceTemplateVersionId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `The document ${fileName} content already exists in version ${eserviceTemplateVersionId} of template ${eserviceTemplateId}`,
    code: "checksumDuplicate",
    title: "Duplicated checksum",
  });
}

export function eserviceTemplateDocumentNotFound(
  eserviceTemplateId: string,
  eserviceTemplateVersionId: string,
  documentId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Document ${documentId} not found in version ${eserviceTemplateVersionId} of template ${eserviceTemplateId}`,
    code: "eserviceTemplateDocumentNotFound",
    title: "Document not found",
  });
}
