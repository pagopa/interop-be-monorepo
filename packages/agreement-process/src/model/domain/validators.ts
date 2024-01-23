import {
  Agreement,
  AgreementState,
  AttributeId,
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  Descriptor,
  DescriptorState,
  EService,
  EServiceAttribute,
  Tenant,
  VerifiedTenantAttribute,
  WithMetadata,
  agreementState,
  descriptorState,
  tenantAttributeType,
  agreementActivableStates,
  agreementActivationFailureStates,
  AgreementId,
  DescriptorId,
  agreementCreationConflictingStates,
  agreementSubmissionConflictingStates,
  TenantAttribute,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { AuthData } from "pagopa-interop-commons";
import { AgreementQuery } from "../../services/readmodel/agreementQuery.js";
import { ApiAgreementPayload } from "../types.js";
import {
  agreementActivationFailed,
  agreementAlreadyExists,
  agreementNotFound,
  agreementNotInExpectedState,
  agreementSubmissionFailed,
  descriptorNotFound,
  descriptorNotInExpectedState,
  documentChangeNotAllowed,
  eServiceNotFound,
  missingCertifiedAttributesError,
  notLatestEServiceDescriptor,
  operationNotAllowed,
  tenantIdNotFound,
} from "./errors.js";
import {
  CertifiedAgreementAttribute,
  DeclaredAgreementAttribute,
  VerifiedAgreementAttribute,
} from "./models.js";

/* ========= ASSERTIONS ========= */

export function assertAgreementExist(
  agreementId: AgreementId,
  agreement: WithMetadata<Agreement> | undefined
): asserts agreement is NonNullable<WithMetadata<Agreement>> {
  if (agreement === undefined) {
    throw agreementNotFound(agreementId);
  }
}

export function assertEServiceExist(
  eServiceId: string,
  eService: WithMetadata<EService> | undefined
): asserts eService is NonNullable<WithMetadata<EService>> {
  if (eService === undefined) {
    throw eServiceNotFound(eServiceId);
  }
}

export const assertRequesterIsConsumer = (
  agreement: Agreement,
  authData: AuthData
): void => {
  if (authData.organizationId !== agreement.consumerId) {
    throw operationNotAllowed(authData.organizationId);
  }
};

export function assertRequesterIsProducer(
  agreement: Agreement,
  authData: AuthData
): void {
  if (authData.organizationId !== agreement.producerId) {
    throw operationNotAllowed(authData.organizationId);
  }
}

export const assertRequesterIsConsumerOrProducer = (
  agreement: Agreement,
  authData: AuthData
): void => {
  try {
    assertRequesterIsConsumer(agreement, authData);
  } catch (error) {
    assertRequesterIsProducer(agreement, authData);
  }
};

export const assertSubmittableState = (
  state: AgreementState,
  agreementId: AgreementId
): void => {
  if (state !== agreementState.draft) {
    throw agreementNotInExpectedState(agreementId, state);
  }
};

export const assertExpectedState = (
  agreementId: AgreementId,
  agreementState: AgreementState,
  expectedStates: AgreementState[]
): void => {
  if (!expectedStates.includes(agreementState)) {
    throw agreementNotInExpectedState(agreementId, agreementState);
  }
};

export function assertTenantExist(
  tenantId: string,
  tenant: WithMetadata<Tenant> | undefined
): asserts tenant is NonNullable<WithMetadata<Tenant>> {
  if (tenant === undefined) {
    throw tenantIdNotFound(tenantId);
  }
}

export const assertCanWorkOnConsumerDocuments = (
  state: AgreementState
): void => {
  if (state !== agreementState.draft && state !== agreementState.pending) {
    throw documentChangeNotAllowed(state);
  }
};

export const assertActivableState = (agreement: Agreement): void => {
  if (!agreementActivableStates.includes(agreement.state)) {
    throw agreementNotInExpectedState(agreement.id, agreement.state);
  }
};

export function assertDescriptorExist(
  eserviceId: string,
  descriptorId: DescriptorId,
  descriptor: Descriptor | undefined
): asserts descriptor is NonNullable<Descriptor> {
  if (descriptor === undefined) {
    throw descriptorNotFound(eserviceId, descriptorId);
  }
}

/* =========  VALIDATIONS ========= */

const validateDescriptorState = (
  eserviceId: EService["id"],
  descriptorId: Descriptor["id"],
  descriptorState: DescriptorState,
  allowedStates: DescriptorState[]
): void => {
  if (!allowedStates.includes(descriptorState)) {
    throw descriptorNotInExpectedState(eserviceId, descriptorId, allowedStates);
  }
};

const validateLatestDescriptor = (
  eService: EService,
  descriptorId: DescriptorId,
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

export const validateCreationOnDescriptor = (
  eservice: EService,
  descriptorId: DescriptorId
): Descriptor => {
  const allowedStatus = [descriptorState.published];
  return validateLatestDescriptor(eservice, descriptorId, allowedStatus);
};

export const verifyCreationConflictingAgreements = async (
  organizationId: string,
  agreement: ApiAgreementPayload,
  agreementQuery: AgreementQuery
): Promise<void> => {
  await verifyConflictingAgreements(
    organizationId,
    agreement.eserviceId,
    agreementCreationConflictingStates,
    agreementQuery
  );
};

export const verifySubmissionConflictingAgreements = async (
  agreement: Agreement,
  agreementQuery: AgreementQuery
): Promise<void> => {
  await verifyConflictingAgreements(
    agreement.consumerId,
    agreement.eserviceId,
    agreementSubmissionConflictingStates,
    agreementQuery
  );
};

export const validateCertifiedAttributes = (
  descriptor: Descriptor,
  consumer: Tenant
): void => {
  if (!certifiedAttributesSatisfied(descriptor, consumer)) {
    throw missingCertifiedAttributesError(descriptor.id, consumer.id);
  }
};

export const validateSubmitOnDescriptor = async (
  eservice: EService,
  descriptorId: DescriptorId
): Promise<Descriptor> => {
  const allowedStatus: DescriptorState[] = [
    descriptorState.published,
    descriptorState.suspended,
  ];
  return validateLatestDescriptor(eservice, descriptorId, allowedStatus);
};

export const validateActiveOrPendingAgreement = (
  agreementId: AgreementId,
  state: AgreementState
): void => {
  if (agreementState.active !== state && agreementState.pending !== state) {
    throw agreementSubmissionFailed(agreementId);
  }
};

export const certifiedAttributesSatisfied = (
  descriptor: Descriptor,
  tenant: Tenant
): boolean => {
  const certifiedAttributes = tenant.attributes.filter(
    (e) => e.type === tenantAttributeType.CERTIFIED
  ) as CertifiedTenantAttribute[];

  return attributesSatisfied(
    descriptor.attributes.certified,
    certifiedAttributes
  );
};

export const declaredAttributesSatisfied = (
  descriptor: Descriptor,
  tenant: Tenant
): boolean => {
  const declaredAttributes = tenant.attributes.filter(
    (e) => e.type === tenantAttributeType.DECLARED
  ) as DeclaredTenantAttribute[];

  return attributesSatisfied(
    descriptor.attributes.declared,
    declaredAttributes
  );
};

export const verifiedAttributesSatisfied = (
  producerId: string,
  descriptor: Descriptor,
  tenant: Tenant
): boolean => {
  const producersAttributesNotExpired = filterVerifiedAttributes(
    producerId,
    tenant
  );

  return attributesSatisfied(
    descriptor.attributes.verified,
    producersAttributesNotExpired
  );
};

export const verifyConflictingAgreements = async (
  consumerId: string,
  eserviceId: string,
  conflictingStates: AgreementState[],
  agreementQuery: AgreementQuery
): Promise<void> => {
  const agreements = await agreementQuery.getAllAgreements({
    consumerId,
    eserviceId,
    agreementStates: conflictingStates,
  });

  if (agreements.length > 0) {
    throw agreementAlreadyExists(consumerId, eserviceId);
  }
};

export const verifyConsumerDoesNotActivatePending = (
  agreement: Agreement,
  authData: AuthData
): void => {
  const activationPendingNotAllowed =
    agreement.state === agreementState.pending &&
    agreement.consumerId === authData.organizationId &&
    agreement.producerId !== agreement.consumerId;
  if (activationPendingNotAllowed) {
    throw operationNotAllowed(authData.organizationId);
  }
};

export const validateActivationOnDescriptor = (
  eservice: EService,
  descriptorId: Descriptor["id"]
): Descriptor => {
  const allowedState: DescriptorState[] = [
    descriptorState.published,
    descriptorState.deprecated,
    descriptorState.suspended,
  ];

  const descriptor = eservice.descriptors.find((d) => d.id === descriptorId);
  if (!descriptor) {
    throw descriptorNotFound(eservice.id, descriptorId);
  }

  validateDescriptorState(
    eservice.id,
    descriptor.id,
    descriptor.state,
    allowedState
  );

  return descriptor;
};

const attributesSatisfied = (
  descriptorAttributes: EServiceAttribute[][],
  consumerAttributes: TenantAttribute[]
): boolean => {
  const notRevocatedAttributeIds = filterNotRevocatedAttributes(
    consumerAttributes
  ).map((a) => a.id);

  return descriptorAttributes.every((attributeList) => {
    const attributes = attributeList.map((a) => a.id);
    return (
      attributes.filter((a) => notRevocatedAttributeIds.includes(a)).length > 0
    );
  });
};

/* ========= MATCHERS ========= */

const matchingAttributes = (
  eServiceAttributes: EServiceAttribute[][],
  consumerAttributes: AttributeId[]
): AttributeId[] =>
  eServiceAttributes
    .flatMap((atts) => atts.map((att) => att.id))
    .filter((att) => consumerAttributes.includes(att));

export const matchingCertifiedAttributes = (
  descriptor: Descriptor,
  consumer: Tenant
): CertifiedAgreementAttribute[] => {
  const attributes = consumer.attributes
    .filter(
      (a) => a.type === tenantAttributeType.CERTIFIED && !a.revocationTimestamp
    )
    .map((a) => a.id);

  return matchingAttributes(descriptor.attributes.certified, attributes).map(
    (id) => ({ id } as CertifiedAgreementAttribute)
  );
};

export const matchingDeclaredAttributes = (
  descriptor: Descriptor,
  consumer: Tenant
): DeclaredAgreementAttribute[] => {
  const attributes = consumer.attributes
    .filter(
      (a) => a.type === tenantAttributeType.DECLARED && !a.revocationTimestamp
    )
    .map((a) => a.id);

  return matchingAttributes(descriptor.attributes.declared, attributes).map(
    (id) => ({ id } as DeclaredAgreementAttribute)
  );
};

export const matchingVerifiedAttributes = (
  eService: EService,
  descriptor: Descriptor,
  consumer: Tenant
): VerifiedAgreementAttribute[] => {
  const verifiedAttributes = filterVerifiedAttributes(
    eService.producerId,
    consumer
  ).map((a) => a.id);

  return matchingAttributes(
    descriptor.attributes.verified,
    verifiedAttributes
  ).map((id) => ({ id } as VerifiedAgreementAttribute));
};

/* ========= FILTERS ========= */

export const filterVerifiedAttributes = (
  producerId: string,
  tenant: Tenant
): VerifiedTenantAttribute[] =>
  tenant.attributes.filter(
    (att) =>
      att.type === tenantAttributeType.VERIFIED &&
      att.verifiedBy.find(
        (v) =>
          v.id === producerId &&
          (!v.extensionDate || v.extensionDate > new Date())
      )
  ) as VerifiedTenantAttribute[];

const filterNotRevocatedAttributes = (
  consumerAttributes: TenantAttribute[]
): TenantAttribute[] =>
  consumerAttributes.filter((att) =>
    match(att)
      .with(
        { type: tenantAttributeType.CERTIFIED },
        (a) => !a.revocationTimestamp
      )
      .with(
        { type: tenantAttributeType.DECLARED },
        (a) => !a.revocationTimestamp
      )
      .with({ type: tenantAttributeType.VERIFIED }, () => true)
      .exhaustive()
  );
