import {
  agreementApi,
  attributeRegistryApi,
  authorizationApi,
  catalogApi,
  purposeApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import { Logger } from "pagopa-interop-commons";
import { ApiError, makeApiProblemBuilder } from "pagopa-interop-models";

const errorCodes = {
  agreementNotFound: "0001",
  producerAndConsumerParamMissing: "0002",
  purposeNotFound: "0003",
  activeAgreementByEserviceAndConsumerNotFound: "0004",
  multipleAgreementForEserviceAndConsumer: "0005",
  eserviceNotFound: "0006",
  attributeNotFound: "0007",
  attributeNotFoundInRegistry: "0008",
  eserviceDescriptorNotFound: "0009",
  keyNotFound: "0010",
  attributeAlreadyExists: "0011",
  clientNotFound: "0012",
  tenantNotFound: "0013",
  tenantByOriginNotFound: "0014",
  attributeByOriginNotFound: "0015",
  tenantAttributeNotFound: "0016",
  attributeByCodeNotFound: "0017",
  certifiedAttributeAlreadyAssigned: "0018",
  multipleActiveProducerDelegationsForEservice: "0019",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(
  errorCodes,
  { problemErrorsPassthrough: false } // API Gateway shall not let Problem errors from other services to pass through
);

export function producerAndConsumerParamMissing(): ApiError<ErrorCodes> {
  return new ApiError({
    detail: "Either producerId or consumerId required",
    code: "producerAndConsumerParamMissing",
    title: "Producer and Consumer param missing",
  });
}

export function missingActivePurposeVersion(
  purposeId: purposeApi.Purpose["id"],
  logger: Logger
): ApiError<ErrorCodes> {
  const error = purposeNotFound(purposeId);
  logger.warn(
    `Root cause for Error "${error.title}": there is no active version for purpose ${purposeId}`
  );
  return error;
}

export function activeAgreementByEserviceAndConsumerNotFound(
  eserviceId: agreementApi.Agreement["eserviceId"],
  consumerId: agreementApi.Agreement["consumerId"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Active Agreement not found for EService ${eserviceId} and Consumer ${consumerId}`,
    code: "activeAgreementByEserviceAndConsumerNotFound",
    title: "Active Agreement not found",
  });
}

export function multipleAgreementForEserviceAndConsumer(
  eserviceId: agreementApi.Agreement["eserviceId"],
  consumerId: agreementApi.Agreement["consumerId"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Unexpected multiple Active Agreements for EService ${eserviceId} and Consumer ${consumerId}`,
    code: "multipleAgreementForEserviceAndConsumer",
    title: "Multiple active Agreements found",
  });
}

export function missingAvailableDescriptor(
  eserviceId: catalogApi.EService["id"],
  logger: Logger
): ApiError<ErrorCodes> {
  const error = eserviceNotFound(eserviceId);
  logger.warn(
    `Root cause for Error "${error.title}": no available descriptors for EService ${eserviceId}`
  );
  return error;
}

export function unexpectedDescriptorState(
  state: catalogApi.EServiceDescriptorState,
  eserviceId: catalogApi.EService["id"],
  descriptorId: catalogApi.EServiceDescriptor["id"],
  logger: Logger
): ApiError<ErrorCodes> {
  const error = eserviceDescriptorNotFound(eserviceId, descriptorId);
  logger.warn(
    `Root cause for Error "${error.title}": Unexpected Descriptor state: ${state} for Descriptor ${descriptorId}`
  );
  return error;
}

export function attributeNotFoundInRegistry(
  attributeId: attributeRegistryApi.Attribute["id"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attribute ${attributeId} not found in Attribute Registry`,
    code: "attributeNotFoundInRegistry",
    title: "Attribute not found in Attribute Registry",
  });
}

export function eserviceDescriptorNotFound(
  eserviceId: catalogApi.EService["id"],
  descriptorId: catalogApi.EServiceDescriptor["id"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor ${descriptorId} not found for EService ${eserviceId}`,
    code: "eserviceDescriptorNotFound",
    title: "Descriptor not found",
  });
}

export function keyNotFound(kId: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Key with kId ${kId} not found`,
    code: "keyNotFound",
    title: "Key not found",
  });
}

export function agreementNotFound(
  agreementId: agreementApi.Agreement["id"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Agreement ${agreementId} not found`,
    code: "agreementNotFound",
    title: "Agreement not found",
  });
}

export function invalidAgreementState(
  agreementId: agreementApi.Agreement["id"],
  logger: Logger
): ApiError<ErrorCodes> {
  const error = agreementNotFound(agreementId);
  logger.warn(
    `Root cause for Error "${error.title}": cannot retrieve agreement in DRAFT state`
  );
  return error;
}

export function attributeAlreadyExists(
  name: attributeRegistryApi.Attribute["name"],
  code: attributeRegistryApi.Attribute["code"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attribute ${name} with code ${code} already exists`,
    code: "attributeAlreadyExists",
    title: "Attribute already exists",
  });
}

export function attributeNotFound(
  attributeId: attributeRegistryApi.Attribute["id"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attribute ${attributeId} not found`,
    code: "attributeNotFound",
    title: "Attribute not found",
  });
}

export function clientNotFound(
  clientId: authorizationApi.Client["id"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Client ${clientId} not found`,
    code: "clientNotFound",
    title: "Client not found",
  });
}

export function eserviceNotFound(
  eserviceId: catalogApi.EService["id"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eserviceId} not found`,
    code: "eserviceNotFound",
    title: "EService not found",
  });
}

export function purposeNotFound(
  purposeId: purposeApi.Purpose["id"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose ${purposeId} not found`,
    code: "purposeNotFound",
    title: "Purpose not found",
  });
}

export function tenantNotFound(
  tenantId: tenantApi.Tenant["id"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant ${tenantId} not found`,
    code: "tenantNotFound",
    title: "Tenant not found",
  });
}

export function tenantByOriginNotFound(
  origin: tenantApi.ExternalId["origin"],
  externalId: tenantApi.ExternalId["value"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant (${origin}, ${externalId}) not found`,
    code: "tenantByOriginNotFound",
    title: "Tenant not found",
  });
}

export function attributeByOriginNotFound(
  origin: attributeRegistryApi.Attribute["origin"],
  code: attributeRegistryApi.Attribute["code"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attribute (${origin}, ${code}) not found`,
    code: "attributeByOriginNotFound",
    title: "Attribute by origin not found",
  });
}

export function tenantAttributeNotFound(
  origin: tenantApi.ExternalId["origin"],
  externalId: tenantApi.ExternalId["value"],
  attributeCode: attributeRegistryApi.Attribute["code"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attribute ${attributeCode} for Institution (${origin}, ${externalId}) not found`,
    code: "tenantAttributeNotFound",
    title: "Institution attribute not found",
  });
}

export function attributeByCodeNotFound(
  attributeCode: attributeRegistryApi.Attribute["code"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attribute ${attributeCode} not found`,
    code: "attributeByCodeNotFound",
    title: "Attribute by code not found",
  });
}

export function certifiedAttributeAlreadyAssigned(
  origin: tenantApi.ExternalId["origin"],
  externalId: tenantApi.ExternalId["value"],
  attributeCode: attributeRegistryApi.Attribute["code"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Certified attribute ${attributeCode} already assigned to Institution (${origin}, ${externalId})`,
    code: "certifiedAttributeAlreadyAssigned",
    title: "Certified attribute already assigned",
  });
}

export function multipleActiveProducerDelegationsForEservice(
  eserviceId: catalogApi.EService["id"]
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Unexpected multiple active producer delegations for EService ${eserviceId}`,
    code: "multipleActiveProducerDelegationsForEservice",
    title: "Multiple active producer delegation found",
  });
}
