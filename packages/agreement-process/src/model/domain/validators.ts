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
  agreementState,
  descriptorState,
  tenantAttributeType,
  AgreementId,
  DescriptorId,
  EServiceId,
  unsafeBrandId,
  TenantAttribute,
  TenantId,
} from "pagopa-interop-models";
import { agreementApi } from "pagopa-interop-api-clients";
import { AuthData } from "pagopa-interop-commons";
import { ReadModelService } from "../../services/readModelService.js";
import {
  agreementActivationFailed,
  agreementAlreadyExists,
  agreementNotInExpectedState,
  agreementSubmissionFailed,
  descriptorNotFound,
  descriptorNotInExpectedState,
  documentChangeNotAllowed,
  missingCertifiedAttributesError,
  notLatestEServiceDescriptor,
  operationNotAllowed,
} from "./errors.js";
import {
  CertifiedAgreementAttribute,
  CompactTenant,
  DeclaredAgreementAttribute,
  VerifiedAgreementAttribute,
} from "./models.js";

/* ========= STATES ========= */
export const agreementActivableStates: AgreementState[] = [
  agreementState.pending,
  agreementState.suspended,
];

export const agreementActivationAllowedDescriptorStates: DescriptorState[] = [
  descriptorState.published,
  descriptorState.suspended,
  descriptorState.deprecated,
];

export const agreementSuspendableStates: AgreementState[] = [
  agreementState.active,
  agreementState.suspended,
];
export const agreementArchivableStates: AgreementState[] = [
  agreementState.active,
  agreementState.suspended,
];
export const agreementSubmittableStates: AgreementState[] = [
  agreementState.draft,
];

export const agreementUpdatableStates: AgreementState[] = [
  agreementState.draft,
];

export const agreementUpgradableStates: AgreementState[] = [
  agreementState.active,
  agreementState.suspended,
];
export const agreementRejectableStates: AgreementState[] = [
  agreementState.pending,
];

export const agreementDeletableStates: AgreementState[] = [
  agreementState.draft,
  agreementState.missingCertifiedAttributes,
];

export const agreementClonableStates: AgreementState[] = [
  agreementState.rejected,
];

export const agreementActivationFailureStates: AgreementState[] = [
  agreementState.draft,
  agreementState.pending,
  agreementState.missingCertifiedAttributes,
];

export const agreementCloningConflictingStates: AgreementState[] = [
  agreementState.draft,
  agreementState.pending,
  agreementState.missingCertifiedAttributes,
  agreementState.active,
  agreementState.suspended,
];

export const agreementCreationConflictingStates: AgreementState[] = [
  agreementState.draft,
  agreementState.pending,
  agreementState.missingCertifiedAttributes,
  agreementState.active,
  agreementState.suspended,
];

export const agreementSubmissionConflictingStates: AgreementState[] = [
  agreementState.pending,
  agreementState.missingCertifiedAttributes,
];

export const agreementConsumerDocumentChangeValidStates: AgreementState[] = [
  agreementState.draft,
  agreementState.pending,
];

/* ========= ASSERTIONS ========= */

export const assertRequesterIsConsumer = (
  agreement: Agreement,
  authData: AuthData
): void => {
  if (
    !authData.userRoles.includes("internal") &&
    authData.organizationId !== agreement.consumerId
  ) {
    throw operationNotAllowed(authData.organizationId);
  }
};

export function assertRequesterIsProducer(
  agreement: Agreement,
  authData: AuthData
): void {
  if (
    !authData.userRoles.includes("internal") &&
    authData.organizationId !== agreement.producerId
  ) {
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

export const assertCanWorkOnConsumerDocuments = (
  state: AgreementState
): void => {
  if (!agreementConsumerDocumentChangeValidStates.includes(state)) {
    throw documentChangeNotAllowed(state);
  }
};

export const assertActivableState = (agreement: Agreement): void => {
  if (!agreementActivableStates.includes(agreement.state)) {
    throw agreementNotInExpectedState(agreement.id, agreement.state);
  }
};

/* =========  VALIDATIONS ========= */

const validateDescriptorState = (
  eserviceId: EServiceId,
  descriptorId: DescriptorId,
  descriptorState: DescriptorState,
  allowedStates: DescriptorState[]
): void => {
  if (!allowedStates.includes(descriptorState)) {
    throw descriptorNotInExpectedState(eserviceId, descriptorId, allowedStates);
  }
};

const validateLatestDescriptor = (
  eservice: EService,
  descriptorId: DescriptorId,
  allowedStates: DescriptorState[]
): Descriptor => {
  const recentActiveDescriptors = eservice.descriptors
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
    eservice.id,
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
  organizationId: TenantId,
  agreement: agreementApi.AgreementPayload,
  readModelService: ReadModelService
): Promise<void> => {
  await verifyConflictingAgreements(
    organizationId,
    unsafeBrandId(agreement.eserviceId),
    agreementCreationConflictingStates,
    readModelService
  );
};

export const verifySubmissionConflictingAgreements = async (
  agreement: Agreement,
  readModelService: ReadModelService
): Promise<void> => {
  await verifyConflictingAgreements(
    agreement.consumerId,
    unsafeBrandId(agreement.eserviceId),
    agreementSubmissionConflictingStates,
    readModelService
  );
};

export const validateCertifiedAttributes = ({
  descriptor,
  consumer,
}: {
  descriptor: Descriptor;
  consumer: Tenant;
}): void => {
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

const attributesSatisfied = (
  descriptorAttributes: EServiceAttribute[][],
  consumerAttributeIds: Array<TenantAttribute["id"]>
): boolean =>
  descriptorAttributes.every((attributeList) => {
    const attributes = attributeList.map((a) => a.id);
    return (
      attributes.filter((a) => consumerAttributeIds.includes(a)).length > 0
    );
  });

export const certifiedAttributesSatisfied = (
  descriptor: Descriptor,
  tenant: Tenant | CompactTenant
): boolean => {
  const certifiedAttributes = filterCertifiedAttributes(tenant).map(
    (a) => a.id
  );

  return attributesSatisfied(
    descriptor.attributes.certified,
    certifiedAttributes
  );
};

export const declaredAttributesSatisfied = (
  descriptor: Descriptor,
  tenant: Tenant | CompactTenant
): boolean => {
  const declaredAttributes = filterDeclaredAttributes(tenant).map((a) => a.id);

  return attributesSatisfied(
    descriptor.attributes.declared,
    declaredAttributes
  );
};

export const verifiedAttributesSatisfied = (
  producerId: TenantId,
  descriptor: Descriptor,
  tenant: Tenant | CompactTenant
): boolean => {
  const verifiedAttributes = filterVerifiedAttributes(producerId, tenant).map(
    (a) => a.id
  );

  return attributesSatisfied(
    descriptor.attributes.verified,
    verifiedAttributes
  );
};

export const verifyConflictingAgreements = async (
  consumerId: TenantId,
  eserviceId: EServiceId,
  conflictingStates: AgreementState[],
  readModelService: ReadModelService
): Promise<void> => {
  const agreements = await readModelService.getAllAgreements({
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
  const descriptor = eservice.descriptors.find((d) => d.id === descriptorId);
  if (!descriptor) {
    throw descriptorNotFound(eservice.id, descriptorId);
  }

  validateDescriptorState(
    eservice.id,
    descriptor.id,
    descriptor.state,
    agreementActivationAllowedDescriptorStates
  );

  return descriptor;
};

export const failOnActivationFailure = (
  newState: AgreementState,
  agreement: Agreement
): void => {
  if (agreementActivationFailureStates.includes(newState)) {
    throw agreementActivationFailed(agreement.id);
  }
};

/* ========= MATCHERS ========= */

const matchingAttributes = (
  eserviceAttributes: EServiceAttribute[][],
  consumerAttributes: AttributeId[]
): AttributeId[] =>
  eserviceAttributes
    .flatMap((atts) => atts.map((att) => att.id))
    .filter((att) => consumerAttributes.includes(att));

export const matchingCertifiedAttributes = (
  descriptor: Descriptor,
  consumer: Tenant
): CertifiedAgreementAttribute[] => {
  const certifiedAttributes = filterCertifiedAttributes(consumer).map(
    (a) => a.id
  );

  return matchingAttributes(
    descriptor.attributes.certified,
    certifiedAttributes
  ).map((id) => ({ id } as CertifiedAgreementAttribute));
};

export const matchingDeclaredAttributes = (
  descriptor: Descriptor,
  consumer: Tenant
): DeclaredAgreementAttribute[] => {
  const declaredAttributes = filterDeclaredAttributes(consumer).map(
    (a) => a.id
  );

  return matchingAttributes(
    descriptor.attributes.declared,
    declaredAttributes
  ).map((id) => ({ id } as DeclaredAgreementAttribute));
};

export const matchingVerifiedAttributes = (
  eservice: EService,
  descriptor: Descriptor,
  consumer: Tenant
): VerifiedAgreementAttribute[] => {
  const verifiedAttributes = filterVerifiedAttributes(
    eservice.producerId,
    consumer
  ).map((a) => a.id);

  return matchingAttributes(
    descriptor.attributes.verified,
    verifiedAttributes
  ).map((id) => ({ id } as VerifiedAgreementAttribute));
};

/* ========= FILTERS ========= */

export const filterVerifiedAttributes = (
  producerId: TenantId,
  tenant: Tenant | CompactTenant
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

export const filterCertifiedAttributes = (
  tenant: Tenant | CompactTenant
): CertifiedTenantAttribute[] =>
  tenant.attributes.filter(
    (att) =>
      att.type === tenantAttributeType.CERTIFIED && !att.revocationTimestamp
  ) as CertifiedTenantAttribute[];

export const filterDeclaredAttributes = (
  tenant: Tenant | CompactTenant
): DeclaredTenantAttribute[] =>
  tenant.attributes.filter(
    (att) =>
      att.type === tenantAttributeType.DECLARED && !att.revocationTimestamp
  ) as DeclaredTenantAttribute[];
