import {
  Attribute,
  Attributes,
  Descriptor,
  DescriptorState,
  EService,
  PersistentAgreement,
  PersistentAgreementState,
  Tenant,
  TenantAttribute,
  WithMetadata,
  agreementAlreadyExists,
  agreementNotFound,
  descriptorNotInExpectedState,
  descriptorState,
  missingCertifiedAttributesError,
  notLatestEServiceDescriptor,
  operationNotAllowed,
  persistentAgreementState,
  tenantAttributeType,
} from "pagopa-interop-models";
import { ApiAgreementPayload } from "../model/types.js";
import { readModelService } from "./readModelService.js";

const validateLatestDescriptor = (
  eService: EService,
  descriptorId: string,
  allowedStates: DescriptorState[]
): Descriptor => {
  const recentActiveDescriptor = eService.descriptors
    .filter((d) => d.state !== descriptorState.draft)
    .sort((a, b) => Number(a.version) - Number(b.version))
    .find((d) => d.id === descriptorId);

  if (!recentActiveDescriptor) {
    throw notLatestEServiceDescriptor(descriptorId);
  }
  validateDescriptorState(
    eService.id,
    descriptorId,
    recentActiveDescriptor.state,
    allowedStates
  );

  return recentActiveDescriptor;
};

const attributesSatisfied = (
  requested: Attribute[][],
  assigned: string[]
): boolean =>
  requested.every((attributeList) => {
    const attributes = attributeList.map((a) => a.id);
    return attributes.filter((a) => assigned.includes(a)).length > 0;
  });

const validateDescriptorState = (
  eserviceId: string,
  descriptorId: string,
  descriptorState: DescriptorState,
  allowedStates: DescriptorState[]
): void => {
  if (!allowedStates.includes(descriptorState)) {
    throw descriptorNotInExpectedState(eserviceId, descriptorId, allowedStates);
  }
};

const certifiedAttributesSatisfied = (
  eServiceAttributes: Attributes,
  consumerAttributes: TenantAttribute[]
): boolean =>
  attributesSatisfied(
    eServiceAttributes.certified,
    consumerAttributes
      .filter((a) => a.type === "certified" && !a.revocationTimestamp)
      .map((a) => a.id)
  );

const certifiedAttributesDescriptorSatisfied = (
  descriptor: Descriptor,
  consumerAttributes: TenantAttribute[]
): boolean => {
  const certifiedAttributes = consumerAttributes.filter(
    (a) => a.type === tenantAttributeType.CERTIFIED
  );

  return certifiedAttributesSatisfied(
    descriptor.attributes,
    certifiedAttributes
  );
};

const verifyConflictingAgreements = async (
  consumerId: string,
  eserviceId: string,
  conflictingStates: PersistentAgreementState[]
): Promise<void> => {
  const agreements = await readModelService.getAgreements(
    undefined,
    consumerId,
    eserviceId,
    undefined,
    conflictingStates,
    undefined
  );

  if (agreements.length > 0) {
    throw agreementAlreadyExists(consumerId, eserviceId);
  }
};

export function assertAgreementExist(
  agreementId: string,
  agreement: WithMetadata<PersistentAgreement> | undefined
): asserts agreement is NonNullable<WithMetadata<PersistentAgreement>> {
  if (agreement === undefined) {
    throw agreementNotFound(agreementId);
  }
}

export const assertRequesterIsConsumer = (
  consumerId: string,
  requesterId: string
): void => {
  if (consumerId !== requesterId) {
    throw operationNotAllowed(requesterId);
  }
};

export const validateCreationOnDescriptor = (
  eservice: EService,
  descriptorId: string
): Descriptor => {
  const allowedStatus = [descriptorState.published];
  return validateLatestDescriptor(eservice, descriptorId, allowedStatus);
};

export const verifyCreationConflictingAgreements = async (
  organizationId: string,
  agreement: ApiAgreementPayload
): Promise<void> => {
  const conflictingStates: PersistentAgreementState[] = [
    persistentAgreementState.draft,
    persistentAgreementState.pending,
    persistentAgreementState.missingCertifiedAttributes,
    persistentAgreementState.active,
    persistentAgreementState.suspended,
  ];
  await verifyConflictingAgreements(
    organizationId,
    agreement.eserviceId,
    conflictingStates
  );
};

export const validateCertifiedAttributes = (
  descriptor: Descriptor,
  consumer: Tenant
): void => {
  if (
    !certifiedAttributesDescriptorSatisfied(descriptor, consumer.attributes)
  ) {
    throw missingCertifiedAttributesError(descriptor.id, consumer.id);
  }
};
