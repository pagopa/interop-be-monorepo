import {
  attributeRegistryApi,
  delegationApi,
  authorizationApi,
  purposeApi,
  tenantApi,
  catalogApi,
} from "pagopa-interop-api-clients";
import {
  ApiError,
  DescriptorId,
  EServiceId,
  EServiceTemplateId,
  EServiceTemplateVersionId,
  makeApiProblemBuilder,
  PurposeId,
  PurposeTemplateId,
  PurposeVersionId,
  TenantId,
} from "pagopa-interop-models";

const errorCodes = {
  missingMetadata: "0002",
  unexpectedDelegationKind: "0003",
  clientAdminIdNotFound: "0004",
  unexpectedAttributeKind: "0005",
  unexpectedUndefinedAttributeOriginOrCode: "0006",
  attributeNotFound: "0007",
  purposeNotFound: "0008",
  missingActivePurposeVersion: "0009",
  eserviceDescriptorNotFound: "0010",
  taxCodeAndIPACodeConflict: "0011",
  purposeVersionNotFound: "0012",
  agreementNotInSuspendedState: "0013",
  agreementNotInPendingState: "0014",
  missingPurposeVersionWithState: "0015",
  missingPurposeCurrentVersion: "0016",
  eserviceTemplateVersionNotFound: "0017",
  tenantCertifiedAttributeNotFound: "0018",
  eserviceDescriptorInterfaceNotFound: "0019",
  purposeVersionDocumentNotFound: "0020",
  unexpectedClientKind: "0021",
  purposeAgreementNotFound: "0022",
  agreementContractNotFound: "0023",
  requesterIsNotTheDelegateConsumer: "0025",
  cannotEditDeclaredAttributesForTenant: "0026",
  tenantDeclaredAttributeNotFound: "0027",
  tenantVerifiedAttributeNotFound: "0028",
  cannotDeleteLastEServiceDescriptor: "0029",
  eserviceRiskAnalysisNotFound: "0030",
  eserviceTemplateRiskAnalysisNotFound: "0031",
  delegationEServiceMismatch: "0032",
  cannotDeleteLastEServiceTemplateVersion: "0033",
  eserviceDescriptorAttributeNotFound: "0034",
  eserviceTemplateVersionAttributeNotFound: "0035",
  eserviceDescriptorAttributeGroupNotFound: "0036",
  eserviceTemplateVersionAttributeGroupNotFound: "0037",
  purposeTemplateRiskAnalysisFormNotFound: "0038",
  invalidSeedForPurposeFromTemplate: "0039",
  // DPoP related errors (duplicated from authorization-server for isolation)
  dpopProofValidationFailed: "0040",
  dpopProofSignatureValidationFailed: "0041",
  unexpectedDPoPProofForAPIToken: "0042",
  dpopProofJtiAlreadyUsed: "0043",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes, {
  problemErrorsPassthrough: true,
  forceGenericProblemOn500: true,
});

export function missingMetadata(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "Resource metadata is missing",
    code: "missingMetadata",
    title: "Missing metadata",
  });
}

export function unexpectedDelegationKind(
  delegation: delegationApi.Delegation
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Unexpected delegation kind "${delegation.kind}" for delegation ${delegation.id}`,
    code: "unexpectedDelegationKind",
    title: "Unexpected delegation kind",
  });
}

export function unexpectedAttributeKind(
  attribute: attributeRegistryApi.Attribute
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Unexpected attribute kind "${attribute.kind}" for attribute ${attribute.id}`,
    code: "unexpectedAttributeKind",
    title: "Unexpected attribute kind",
  });
}

export function unexpectedUndefinedAttributeOriginOrCode(
  attribute: attributeRegistryApi.Attribute
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attribute ${attribute.id} has undefined origin or code`,
    code: "unexpectedUndefinedAttributeOriginOrCode",
    title: "Unexpected undefined attribute origin or code",
  });
}

export function attributeNotFound(
  attribute: attributeRegistryApi.Attribute
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attribute ${attribute.id} not found`,
    code: "attributeNotFound",
    title: "Attribute not found",
  });
}

export function clientAdminIdNotFound(
  client: authorizationApi.Client
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Admin id not found for client with id ${client.id}`,
    code: "clientAdminIdNotFound",
    title: "Client admin id not found",
  });
}

export function eserviceTemplateVersionNotFound(
  templateId: EServiceTemplateId,
  versionId: EServiceTemplateVersionId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Version ${versionId} not found in eservice template ${templateId}`,
    code: "eserviceTemplateVersionNotFound",
    title: "EService template version not found",
  });
}

export function purposeVersionNotFound(
  purposeId: PurposeId,
  versionId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Version ${versionId} not found in purpose ${purposeId}`,
    code: "purposeVersionNotFound",
    title: "Purpose version not found",
  });
}

export function missingPurposeVersionWithState(
  purposeId: string,
  state: purposeApi.PurposeVersionState
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `There is no ${state} version for purpose ${purposeId}`,
    code: "missingPurposeVersionWithState",
    title: `Missing ${state} purpose version`,
  });
}

export function missingPurposeCurrentVersion(
  purposeId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `There is no current valid version for purpose ${purposeId}`,
    code: "missingPurposeCurrentVersion",
    title: "Missing current purpose version",
  });
}

export function agreementNotInPendingState(
  agreementId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Agreement ${agreementId} is not in pending state`,
    code: "agreementNotInPendingState",
    title: "Agreement not in pending state",
  });
}

export function agreementNotInSuspendedState(
  agreementId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Agreement ${agreementId} is not in suspended state`,
    code: "agreementNotInSuspendedState",
    title: "Agreement not in suspended state",
  });
}

export function taxCodeAndIPACodeConflict(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "IPACode and taxCode query parameters cannot be provided together",
    code: "taxCodeAndIPACodeConflict",
    title: "Tax code and IPA code conflict in tenant query",
  });
}

export function eserviceDescriptorNotFound(
  eserviceId: string,
  descriptorId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor ${descriptorId} not found for eservice ${eserviceId}`,
    code: "eserviceDescriptorNotFound",
    title: "Eservice descriptor not found",
  });
}

export function tenantCertifiedAttributeNotFound(
  tenant: tenantApi.Tenant,
  attributeId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Certified attribute ${attributeId} not found for tenant ${tenant.id}`,
    code: "tenantCertifiedAttributeNotFound",
    title: "Tenant certified attribute not found",
  });
}

export function eserviceDescriptorInterfaceNotFound(
  eserviceId: string,
  descriptorId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Interface for descriptor ${descriptorId} not found for eservice ${eserviceId}`,
    code: "eserviceDescriptorInterfaceNotFound",
    title: "Eservice descriptor interface not found",
  });
}
export function purposeVersionDocumentNotFound(
  purposeId: PurposeId,
  versionId: PurposeVersionId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Document for version ${versionId} of purpose ${purposeId} not found`,
    code: "purposeVersionDocumentNotFound",
    title: "Purpose version document not found",
  });
}

export function unexpectedClientKind(
  client: authorizationApi.Client
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Unexpected client kind "${client.kind}" for client ${client.id}`,
    code: "unexpectedClientKind",
    title: "Unexpected client kind",
  });
}

export function purposeAgreementNotFound(
  purposeId: PurposeId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `No active agreement found for purpose ${purposeId}`,
    code: "purposeAgreementNotFound",
    title: "Agreement for purpose not found",
  });
}

export function agreementContractNotFound(
  agreementId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Contract not found for agreement ${agreementId}`,
    code: "agreementContractNotFound",
    title: "Agreement contract not found",
  });
}

export function delegationEServiceMismatch(
  eserviceId: string,
  delegation: delegationApi.Delegation
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Delegation ${delegation.id} is not a delegation for e-service ${eserviceId}`,
    code: "delegationEServiceMismatch",
    title: "Delegation e-service mismatch",
  });
}

export function tenantDeclaredAttributeNotFound(
  tenant: tenantApi.Tenant,
  attributeId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Declared attribute ${attributeId} not found for tenant ${tenant.id}`,
    code: "tenantDeclaredAttributeNotFound",
    title: "Tenant declared attribute not found",
  });
}

export function tenantVerifiedAttributeNotFound(
  tenant: tenantApi.Tenant,
  attributeId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Verified attribute ${attributeId} not found for tenant ${tenant.id}`,
    code: "tenantVerifiedAttributeNotFound",
    title: "Tenant verified attribute not found",
  });
}

export function requesterIsNotTheDelegateConsumer(
  delegation: delegationApi.Delegation
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Requester tenant is not the delegate consumer for delegation ${delegation.id}`,
    code: "requesterIsNotTheDelegateConsumer",
    title: "Requester is not the delegate consumer",
  });
}

export function cannotEditDeclaredAttributesForTenant(
  targetTenantId: TenantId,
  delegation: delegationApi.Delegation | undefined
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Cannot edit declared attributes for tenant ${targetTenantId}${
      delegation
        ? ` since it is not the delegator for delegation ${delegation.id}`
        : ` without a delegation (delegationId is missing)`
    }`,
    code: "cannotEditDeclaredAttributesForTenant",
    title: "Tenant cannot edit declared attributes",
  });
}

export function eserviceRiskAnalysisNotFound(
  eserviceId: string,
  riskAnalysisId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Risk analysis ${riskAnalysisId} not found for e-service ${eserviceId}`,
    code: "eserviceRiskAnalysisNotFound",
    title: "E-Service risk analysis not found",
  });
}

export function cannotDeleteLastEServiceDescriptor(
  eserviceId: EServiceId,
  descriptorId: DescriptorId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Cannot delete descriptor ${descriptorId} for e-service ${eserviceId} because it is the last remaining descriptor`,
    code: "cannotDeleteLastEServiceDescriptor",
    title: "Cannot delete last e-service descriptor",
  });
}

export function cannotDeleteLastEServiceTemplateVersion(
  templateId: EServiceTemplateId,
  versionId: EServiceTemplateVersionId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Cannot delete version ${versionId} for e-service template ${templateId} because it is the last remaining version`,
    code: "cannotDeleteLastEServiceTemplateVersion",
    title: "Cannot delete last e-service template version",
  });
}

export function eserviceTemplateRiskAnalysisNotFound(
  templateId: string,
  riskAnalysisId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Risk analysis ${riskAnalysisId} not found for e-service template ${templateId}`,
    code: "eserviceTemplateRiskAnalysisNotFound",
    title: "E-Service Template risk analysis not found",
  });
}

export function eserviceDescriptorAttributeNotFound(
  descriptorId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attribute not found for descriptor ${descriptorId}`,
    code: "eserviceDescriptorAttributeNotFound",
    title: "E-Service Descriptor Attribute Not Found",
  });
}

export function eserviceTemplateVersionAttributeNotFound(
  versionId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attribute not found for eservice template version ${versionId}`,
    code: "eserviceTemplateVersionAttributeNotFound",
    title: "E-Service Template Version Attribute Not Found",
  });
}

export function eserviceDescriptorAttributeGroupNotFound(
  kind: keyof catalogApi.Attributes,
  eserviceId: EServiceId,
  descriptorId: DescriptorId,
  groupIndex: number
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `${kind} Attribute group with index ${groupIndex} not found for descriptor ${descriptorId} of e-service ${eserviceId}`,
    code: "eserviceDescriptorAttributeGroupNotFound",
    title: "E-Service Descriptor Attribute Group Not Found",
  });
}

export function eserviceTemplateVersionAttributeGroupNotFound(
  kind: keyof catalogApi.Attributes,
  templateId: EServiceTemplateId,
  versionId: EServiceTemplateVersionId,
  groupIndex: number
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `${kind} Attribute group with index ${groupIndex} not found for e-service template version ${versionId} of template ${templateId}`,
    code: "eserviceTemplateVersionAttributeGroupNotFound",
    title: "E-Service Template Version Attribute Group Not Found",
  });
}

export function purposeTemplateRiskAnalysisFormNotFound(
  purposeTemplateId: PurposeTemplateId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `No Risk Analysis Template Form found for Purpose Template ${purposeTemplateId}`,
    code: "purposeTemplateRiskAnalysisFormNotFound",
    title: "Purpose Template Risk Analysis Form Not Found",
  });
}

export function invalidSeedForPurposeFromTemplate(
  parsingErrors: string[]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Invalid seed to update Purpose created from Purpose Template: ${parsingErrors.join(
      ", "
    )}`,
    code: "invalidSeedForPurposeFromTemplate",
    title: "Invalid seed for purpose from template",
  });
}

export function dpopProofValidationFailed(
  clientId: string | undefined,
  details: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `DPoP proof validation failed for clientId: ${clientId} - ${details}`,
    code: "dpopProofValidationFailed",
    title: "DPoP proof validation failed",
  });
}

export function dpopProofSignatureValidationFailed(
  clientId: string | undefined,
  details: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `DPoP proof signature validation failed for client ${clientId} - ${details}`,
    code: "dpopProofSignatureValidationFailed",
    title: "DPoP proof signature validation failed",
  });
}

export function unexpectedDPoPProofForAPIToken(
  clientId: string | undefined
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Unexpected DPoP proof for API token with client ${clientId}`,
    code: "unexpectedDPoPProofForAPIToken",
    title: "Unexpected DPoP proof for API token",
  });
}

export function dpopProofJtiAlreadyUsed(jti: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `DPoP proof JTI ${jti} already in cache`,
    code: "dpopProofJtiAlreadyUsed",
    title: "DPoP proof JTI already in cache",
  });
}
