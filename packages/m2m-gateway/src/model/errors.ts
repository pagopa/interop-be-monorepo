import {
  attributeRegistryApi,
  delegationApi,
  authorizationApi,
  purposeApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import {
  ApiError,
  DescriptorId,
  EServiceId,
  EServiceTemplateId,
  EServiceTemplateVersionId,
  makeApiProblemBuilder,
  PurposeId,
  PurposeVersionId,
  TenantId,
} from "pagopa-interop-models";

export const errorCodes = {
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
  notAnActiveConsumerDelegation: "0024",
  cannotDeleteLastEServiceDescriptor: "0025",
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

export function notAnActiveConsumerDelegation(
  requesterTenantId: TenantId,
  eserviceId: string,
  delegation: delegationApi.Delegation
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Delegation ${delegation.id} is not an active consumer delegation for e-service ${eserviceId} and delegate ${requesterTenantId}`,
    code: "notAnActiveConsumerDelegation",
    title: "Not an active consumer delegation",
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
