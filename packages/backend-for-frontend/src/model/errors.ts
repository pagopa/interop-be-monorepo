import {
  ApiError,
  AttributeId,
  makeApiProblemBuilder,
  parseErrorMessage,
} from "pagopa-interop-models";

const errorCodes = {
  purposeNotFound: "0001",
  userNotFound: "0002",
  selfcareEntityNotFilled: "0003",
  eserviceIsNotDraft: "0004",
  attributeNotExists: "0005",
  invalidEserviceRequester: "0006",
  tenantLoginNotAllowed: "0007",
  eServiceNotFound: "0008",
  tenantNotFound: "0009",
  agreementNotFound: "0010",
  eserviceDescriptorNotFound: "0011",
  dynamoReadingError: "0012",
  missingInterface: "0013",
  eserviceRiskNotFound: "0014",
  noDescriptorInEservice: "0015",
  missingDescriptorInClonedEservice: "0016",
  agreementDescriptorNotFound: "0017",
  invalidJwtClaim: "0018",
  samlNotValid: "0019",
  missingSelfcareId: "0020",
  invalidZipStructure: "0021",
  contractNotFound: "0022",
  contractException: "0023",
  notValidDescriptor: "0024",
  privacyNoticeNotFoundInConfiguration: "0025",
  privacyNoticeNotFound: "0026",
  privacyNoticeVersionIsNotTheLatest: "0027",
  missingActivePurposeVersion: "0028",
  activeAgreementByEserviceAndConsumerNotFound: "0029",
  purposeIdNotFoundInClientAssertion: "0030",
  delegationNotFound: "0031",
  tenantNotAllowed: "0032",
  cannotGetKeyWithClient: "0033",
  clientAssertionPublicKeyNotFound: "0034",
  delegatedEserviceNotExportable: "0035",
  eserviceTemplateVersionNotFound: "0036",
  catalogEServiceTemplatePublishedVersionNotFound: "0037",
  eserviceTemplateNotFound: "0038",
  eserviceTemplateIsNotPublished: "0039",
  tooManyDescriptorForInterfaceWithTemplate: "0040",
  missingUserRolesInIdentityToken: "0041",
  templateInstanceNotAllowed: "0042",
  tenantBySelfcareIdNotFound: "0043",
  eserviceTemplateInterfaceNotFound: "0044",
  invalidInterfaceFile: "0045",
  eserviceTemplateInterfaceDataNotValid: "0046",
  invalidEserviceInterfaceFileDetected: "0047",
  operationForbidden: "0048",
  noVersionInEServiceTemplate: "0049",
  delegationContractNotFound: "0050",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes, {
  problemErrorsPassthrough: true,
  forceGenericProblemOn500: true,
});

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

export function dynamoReadingError(error: unknown): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Error while reading data from Dynamo -> ${parseErrorMessage(
      error
    )}`,
    code: "dynamoReadingError",
    title: "Dynamo reading error",
  });
}

export function privacyNoticeNotFoundInConfiguration(
  privacyNoticeKind: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Privacy Notice ${privacyNoticeKind} not found in configuration`,
    code: "privacyNoticeNotFoundInConfiguration",
    title: "Privacy Notice not found in configuration",
  });
}

export function privacyNoticeNotFound(
  privacyNoticeKind: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Privacy Notice ${privacyNoticeKind} not found`,
    code: "privacyNoticeNotFound",
    title: "Privacy Notice not found",
  });
}

export function privacyNoticeVersionIsNotTheLatest(
  versionId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `PrivacyNotice version ${versionId} not found`,
    code: "privacyNoticeVersionIsNotTheLatest",
    title: "Privacy Notice version is not the latest",
  });
}

export function agreementDescriptorNotFound(
  agreementId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor of agreement ${agreementId} not found`,
    code: "agreementDescriptorNotFound",
    title: "Agreement descriptor not found",
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

export function tenantBySelfcareIdNotFound(
  selfcareId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant with Selfcare ID ${selfcareId} not found`,
    code: "tenantBySelfcareIdNotFound",
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

export function attributeNotExists(id: AttributeId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attribute ${id} does not exist in the attribute registry`,
    code: "attributeNotExists",
    title: "Attribute not exists",
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

export function samlNotValid(message: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Error while validating saml -> ${message}`,
    code: "samlNotValid",
    title: "SAML not valid",
  });
}

export function missingSelfcareId(tenantId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `SelfcareId in Tenant ${tenantId} not found`,
    code: "missingSelfcareId",
    title: "SelfcareId not found",
  });
}

export function eserviceRiskNotFound(
  eserviceId: string,
  riskAnalysisId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `RiskAnalysis ${riskAnalysisId} not found in Eservice ${eserviceId}`,
    code: "eserviceRiskNotFound",
    title: "Risk analysis not found",
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

export function noDescriptorInEservice(
  eserviceId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `No descriptor found in Eservice ${eserviceId}`,
    code: "noDescriptorInEservice",
    title: "No descriptor found in Eservice",
  });
}
export function noVersionInEServiceTemplate(
  eserviceTemplateId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `No version found in Eservice template ${eserviceTemplateId}`,
    code: "noVersionInEServiceTemplate",
    title: "No version found in Eservice template",
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

export function notValidDescriptor(
  descriptorId: string,
  state: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor ${descriptorId} is in an invalid state ${state} for this operation`,
    code: "notValidDescriptor",
    title: "Not valid descriptor",
  });
}

export function contractNotFound(agreementId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Contract not found for agreement ${agreementId}`,
    code: "contractNotFound",
    title: "Contract not found",
  });
}

export function contractException(agreementId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `There is no contract to download for agreement ${agreementId}`,
    code: "contractException",
    title: "Contract not available",
  });
}

export function invalidZipStructure(description: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Invalid zip structure: ${description}`,
    code: "invalidZipStructure",
    title: "Invalid zip structure",
  });
}

export function missingActivePurposeVersion(
  purposeId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `There is no active version for purpose ${purposeId}`,
    code: "missingActivePurposeVersion",
    title: "Missing active purpose version",
  });
}

export function activeAgreementByEserviceAndConsumerNotFound(
  eserviceId: string,
  consumerId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Active agreement for Eservice ${eserviceId} and consumer ${consumerId} not found`,
    code: "activeAgreementByEserviceAndConsumerNotFound",
    title: "Active agreement not found",
  });
}

export function purposeIdNotFoundInClientAssertion(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `PurposeId not found in client assertion`,
    code: "purposeIdNotFoundInClientAssertion",
    title: "PurposeId not found in client assertion",
  });
}

export function clientAssertionPublicKeyNotFound(
  kid: string,
  clientId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Public key with kid ${kid} not found for client ${clientId}`,
    code: "clientAssertionPublicKeyNotFound",
    title: "Client assertion public key not found",
  });
}

export function tenantNotAllowed(clientId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant not allowed for client ${clientId}`,
    code: "tenantNotAllowed",
    title: "Tenant not allowed",
  });
}

export function cannotGetKeyWithClient(
  clientId: string,
  keyId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Cannot get key with client ${clientId} and key ${keyId}`,
    code: "cannotGetKeyWithClient",
    title: "Cannot get key with client",
  });
}

export function delegationNotFound(delegationId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Delegation ${delegationId} not found`,
    code: "delegationNotFound",
    title: "Delegation not found",
  });
}

export function delegationContractNotFound(
  delegationId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Delegation contract for delegation ${delegationId} not found`,
    code: "delegationContractNotFound",
    title: "Delegation contract not found",
  });
}

export function delegatedEserviceNotExportable(
  delegatorId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Impossibile to export Eservice with a valid delegation for producer ${delegatorId}`,
    code: "delegatedEserviceNotExportable",
    title: "Delegated Eservice is not exportable",
  });
}

export function eserviceTemplateVersionNotFound(
  eserviceTemplateId: string,
  eserviceTemplateVersionId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Version ${eserviceTemplateVersionId} not found in Eservice template ${eserviceTemplateId}`,
    code: "eserviceTemplateVersionNotFound",
    title: "EService template version not found",
  });
}

export function catalogEServiceTemplatePublishedVersionNotFound(
  eserviceTemplateId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Published version not found in catalog Eservice template ${eserviceTemplateId}`,
    code: "catalogEServiceTemplatePublishedVersionNotFound",
    title: "Catalog EService template published version not found",
  });
}

export function eserviceTemplateNotFound(
  eserviceTemplateId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Eservice template ${eserviceTemplateId} not found`,
    code: "eserviceTemplateNotFound",
    title: "EService template not found",
  });
}

export function eserviceIsNotDraft(eserviceId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eserviceId} is not in draft state`,
    code: "eserviceIsNotDraft",
    title: "EService is not in draft state",
  });
}

export function eserviceTemplateNotPublished(
  eserviceTemplateId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService template ${eserviceTemplateId} is not in published state`,
    code: "eserviceTemplateIsNotPublished",
    title: "EService template is not in published state",
  });
}

export function missingUserRolesInIdentityToken(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "Unable to extract userRoles from claims",
    code: "missingUserRolesInIdentityToken",
    title: "Unable to extract userRoles from claims",
  });
}

export function templateInstanceNotAllowed(
  eserviceId: string,
  eServiceTemplateId: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Operation not allowed on EService ${eserviceId} instance of template ${eServiceTemplateId}`,
    code: "templateInstanceNotAllowed",
    title: "TemplateId must be undefined",
  });
}
