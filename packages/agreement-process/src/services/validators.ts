import {
  CertifiedTenantAttribute,
  Descriptor,
  DescriptorState,
  EService,
  EServiceAttribute,
  Tenant,
  WithMetadata,
  agreementAlreadyExists,
  agreementNotFound,
  Agreement,
  AgreementState,
  agreementState,
  descriptorNotInExpectedState,
  descriptorState,
  missingCertifiedAttributesError,
  notLatestEServiceDescriptor,
  operationNotAllowed,
  tenantAttributeType,
} from "pagopa-interop-models";
import { ApiAgreementPayload } from "../model/types.js";
import { ReadModelService } from "./readModelService.js";

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

const validateLatestDescriptor = (
  eService: EService,
  descriptorId: string,
  allowedStates: DescriptorState[]
): Descriptor => {
  const recentActiveDescriptors = eService.descriptors
    .filter((d) => d.state !== descriptorState.draft)
    .sort((a, b) => Number(b.version) - Number(a.version));

  if (
    recentActiveDescriptors.length < 1 ||
    recentActiveDescriptors[0].id !== descriptorId
  ) {
    throw notLatestEServiceDescriptor(descriptorId);
  }

  const recentActiveDescriptor = recentActiveDescriptors[0];
  validateDescriptorState(
    eService.id,
    descriptorId,
    recentActiveDescriptor.state,
    allowedStates
  );

  return recentActiveDescriptor;
};

const certifiedAttributesDescriptorSatisfied = (
  descriptorAttributes: EServiceAttribute[][],
  consumerAttributes: CertifiedTenantAttribute[]
): boolean => {
  const consumerCertifiedAttributesIds = consumerAttributes
    .filter((a) => !a.revocationTimestamp)
    .map((a) => a.id);

  return descriptorAttributes.every((attributeList) => {
    const attributes = attributeList.map((a) => a.id);
    return (
      attributes.filter((a) => consumerCertifiedAttributesIds.includes(a))
        .length > 0
    );
  });
};

const verifyConflictingAgreements = async (
  readModelService: ReadModelService,
  consumerId: string,
  eserviceId: string,
  conflictingStates: AgreementState[]
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
  agreement: WithMetadata<Agreement> | undefined
): asserts agreement is NonNullable<WithMetadata<Agreement>> {
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
  readModelService: ReadModelService,
  organizationId: string,
  agreement: ApiAgreementPayload
): Promise<void> => {
  const conflictingStates: AgreementState[] = [
    agreementState.draft,
    agreementState.pending,
    agreementState.missingCertifiedAttributes,
    agreementState.active,
    agreementState.suspended,
  ];
  await verifyConflictingAgreements(
    readModelService,
    organizationId,
    agreement.eserviceId,
    conflictingStates
  );
};

export const validateCertifiedAttributes = (
  descriptor: Descriptor,
  consumer: Tenant
): void => {
  const certifiedAttributes = consumer.attributes.filter(
    (e) => e.type === tenantAttributeType.CERTIFIED
  ) as CertifiedTenantAttribute[];

  if (
    !certifiedAttributesDescriptorSatisfied(
      descriptor.attributes.certified,
      certifiedAttributes
    )
  ) {
    throw missingCertifiedAttributesError(descriptor.id, consumer.id);
  }
};
