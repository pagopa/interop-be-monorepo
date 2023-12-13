import {
  Agreement,
  AgreementState,
  CertifiedAgreementAttribute,
  CertifiedTenantAttribute,
  DeclaredAgreementAttribute,
  DeclaredTenantAttribute,
  Descriptor,
  DescriptorState,
  EService,
  EServiceAttribute,
  Tenant,
  VerifiedAgreementAttribute,
  VerifiedTenantAttribute,
  WithMetadata,
  agreementAttributeType,
  agreementState,
  descriptorState,
  tenantAttributeType,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { AgreementQuery } from "../../services/readmodel/agreementQuery.js";
import { ApiAgreementPayload } from "../types.js";
import {
  agreementAlreadyExists,
  agreementNotFound,
  agreementNotInExpectedState,
  agreementSubmissionFailed,
  descriptorNotInExpectedState,
  missingCertifiedAttributesError,
  notLatestEServiceDescriptor,
  operationNotAllowed,
} from "./errors.js";

type NotRevocableTenantAttribute = Pick<VerifiedTenantAttribute, "id">;
type RevocableTenantAttribute =
  | Pick<CertifiedTenantAttribute, "id" | "revocationTimestamp">
  | Pick<DeclaredTenantAttribute, "id" | "revocationTimestamp">;

/* ========= ASSERTIONS ========= */

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

export const assertSubmittableState = (
  state: AgreementState,
  agreementId: string
): void => {
  if (state !== agreementState.draft) {
    throw agreementNotInExpectedState(agreementId, state);
  }
};

export const assertExpectedState = (
  agreementId: string,
  agreementState: AgreementState,
  expectedStates: AgreementState[]
): void => {
  if (!expectedStates.includes(agreementState)) {
    throw agreementNotInExpectedState(agreementId, agreementState);
  }
};

/* =========  VALIDATIONS ========= */

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

export const validateCreationOnDescriptor = (
  eservice: EService,
  descriptorId: string
): Descriptor => {
  const allowedStatus = [descriptorState.published];
  return validateLatestDescriptor(eservice, descriptorId, allowedStatus);
};

export const verifyCreationConflictingAgreements = async (
  organizationId: string,
  agreement: ApiAgreementPayload,
  agreementQuery: AgreementQuery
): Promise<void> => {
  const conflictingStates: AgreementState[] = [
    agreementState.draft,
    agreementState.pending,
    agreementState.missingCertifiedAttributes,
    agreementState.active,
    agreementState.suspended,
  ];
  await verifyConflictingAgreements(
    organizationId,
    agreement.eserviceId,
    conflictingStates,
    agreementQuery
  );
};

export const verifySubmissionConflictingAgreements = async (
  agreement: Agreement,
  agreementQuery: AgreementQuery
): Promise<void> => {
  const conflictingStates: AgreementState[] = [
    agreementState.pending,
    agreementState.missingCertifiedAttributes,
  ];
  await verifyConflictingAgreements(
    agreement.consumerId,
    agreement.eserviceId,
    conflictingStates,
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
  descriptorId: string
): Promise<Descriptor> => {
  const allowedStatus: DescriptorState[] = [
    descriptorState.published,
    descriptorState.suspended,
  ];
  return validateLatestDescriptor(eservice, descriptorId, allowedStatus);
};

export const validateActiveOrPendingAgreement = (
  agreementId: string,
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

const verifyConflictingAgreements = async (
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

const attributesSatisfied = <
  T extends RevocableTenantAttribute | NotRevocableTenantAttribute
>(
  descriptorAttributes: EServiceAttribute[][],
  consumerAttributes: T[]
): boolean => {
  const notRevocatedAttributeIds = consumerAttributes
    .filter(notRevocatedTenantAttributesFilter(consumerAttributes))
    .map((a) => a.id);

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
  consumerAttributes: string[]
): string[] =>
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
    (id) => ({
      type: agreementAttributeType.CERTIFIED,
      id,
    })
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
    (id) => ({
      type: agreementAttributeType.DECLARED,
      id,
    })
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
  ).map((id) => ({
    type: agreementAttributeType.VERIFIED,
    id,
  }));
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

const notRevocatedTenantAttributesFilter = <
  T extends RevocableTenantAttribute | NotRevocableTenantAttribute
>(
  att: T[]
): ((a: T) => boolean) =>
  match(att)
    .with(
      P.array({ revocationTimestamp: P.instanceOf(Date) }),
      () =>
        (a: RevocableTenantAttribute): boolean =>
          !a.revocationTimestamp
    )
    .otherwise(() => () => true);
