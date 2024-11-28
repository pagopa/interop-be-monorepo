import {
  agreementApi,
  apiGatewayApi,
  attributeRegistryApi,
  catalogApi,
  delegationApi,
  purposeApi,
} from "pagopa-interop-api-clients";
import { operationForbidden, TenantId } from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import {
  activeAgreementByEserviceAndConsumerNotFound,
  attributeNotFoundInRegistry,
  invalidAgreementState,
  missingActivePurposeVersion,
  missingAvailableDescriptor,
  multipleAgreementForEserviceAndConsumer,
  unexpectedDescriptorState,
  multipleActiveProducerDelegationsForEservice,
} from "../models/errors.js";
import { NonDraftCatalogApiDescriptor } from "../api/catalogApiConverter.js";

export function assertAgreementStateNotDraft(
  agreementState: agreementApi.AgreementState,
  agreementId: agreementApi.Agreement["id"],
  logger: Logger
): asserts agreementState is apiGatewayApi.AgreementState {
  if (agreementState === agreementApi.AgreementState.Values.DRAFT) {
    throw invalidAgreementState(agreementId, logger);
  }
}

export function assertActivePurposeVersionExists(
  purposeVersion: purposeApi.PurposeVersion | undefined,
  purposeId: purposeApi.Purpose["id"],
  logger: Logger
): asserts purposeVersion is NonNullable<purposeApi.PurposeVersion> {
  if (!purposeVersion) {
    throw missingActivePurposeVersion(purposeId, logger);
  }
}

export function assertIsEserviceProducer(
  eservice: catalogApi.EService,
  organizationId: TenantId
): void {
  if (eservice.producerId !== organizationId) {
    throw operationForbidden;
  }
}

export function assertOnlyOneAgreementForEserviceAndConsumerExists(
  agreements: apiGatewayApi.Agreement[],
  eserviceId: apiGatewayApi.Agreement["eserviceId"],
  consumerId: apiGatewayApi.Agreement["consumerId"]
): asserts agreements is [apiGatewayApi.Agreement] {
  if (agreements.length === 0) {
    throw activeAgreementByEserviceAndConsumerNotFound(eserviceId, consumerId);
  } else if (agreements.length > 1) {
    throw multipleAgreementForEserviceAndConsumer(eserviceId, consumerId);
  }
}

export function assertAvailableDescriptorExists(
  descriptor: catalogApi.EServiceDescriptor | undefined,
  eserviceId: apiGatewayApi.EService["id"],
  logger: Logger
): asserts descriptor is NonNullable<catalogApi.EServiceDescriptor> {
  if (!descriptor) {
    throw missingAvailableDescriptor(eserviceId, logger);
  }
}

export function assertNonDraftDescriptor(
  descriptor: catalogApi.EServiceDescriptor,
  descriptorId: catalogApi.EServiceDescriptor["id"],
  eserviceId: catalogApi.EService["id"],
  logger: Logger
): asserts descriptor is NonDraftCatalogApiDescriptor {
  if (descriptor.state === catalogApi.EServiceDescriptorState.Values.DRAFT) {
    throw unexpectedDescriptorState(
      descriptor.state,
      eserviceId,
      descriptorId,
      logger
    );
  }
}

export function assertRegistryAttributeExists(
  registryAttribute: attributeRegistryApi.Attribute | undefined,
  attributeId: attributeRegistryApi.Attribute["id"]
): asserts registryAttribute is NonNullable<attributeRegistryApi.Attribute> {
  if (!registryAttribute) {
    throw attributeNotFoundInRegistry(attributeId);
  }
}

export function assertIsEserviceDelegateProducer(
  producerDelegation: delegationApi.Delegation | undefined,
  organizationId: TenantId
): void {
  if (
    !producerDelegation ||
    producerDelegation.kind !==
      delegationApi.DelegationKind.Values.DELEGATED_PRODUCER ||
    producerDelegation.delegateId !== organizationId
  ) {
    throw operationForbidden;
  }
}

export function assertOnlyOneActiveProducerDelegationForEserviceExists(
  producerDelegations: delegationApi.Delegations,
  eserviceId: apiGatewayApi.EService["id"]
): void {
  if (
    producerDelegations.results.filter(
      (d) => d.kind !== delegationApi.DelegationKind.Values.DELEGATED_PRODUCER
    ).length > 1
  ) {
    throw multipleActiveProducerDelegationsForEservice(eserviceId);
  }
}
