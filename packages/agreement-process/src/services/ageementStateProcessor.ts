import {
  Agreement,
  AgreementStamp,
  AgreementState,
  Descriptor,
  Tenant,
  agreementState,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { utcToZonedTime } from "date-fns-tz";
import {
  certifiedAttributesSatisfied,
  declaredAttributesSatisfied,
  verifiedAttributesSatisfied,
} from "../model/domain/validators.js";

const {
  draft,
  suspended,
  archived,
  missingCertifiedAttributes,
  pending,
  active,
  rejected,
} = agreementState;

const nextStateFromDraft = (
  agreement: Agreement,
  descriptor: Descriptor,
  tenant: Tenant
): AgreementState => {
  if (agreement.consumerId === agreement.producerId) {
    return active;
  }
  if (!certifiedAttributesSatisfied(descriptor, tenant)) {
    return missingCertifiedAttributes;
  }

  if (
    descriptor.agreementApprovalPolicy?.includes("Automatic") &&
    declaredAttributesSatisfied(descriptor, tenant) &&
    verifiedAttributesSatisfied(agreement.producerId, descriptor, tenant)
  ) {
    return active;
  }
  if (declaredAttributesSatisfied(descriptor, tenant)) {
    return pending;
  }
  return draft;
};

const nextStateFromPending = (
  agreement: Agreement,
  descriptor: Descriptor,
  tenant: Tenant
): AgreementState => {
  if (!certifiedAttributesSatisfied(descriptor, tenant)) {
    return missingCertifiedAttributes;
  }
  if (!declaredAttributesSatisfied(descriptor, tenant)) {
    return draft;
  }
  if (!verifiedAttributesSatisfied(agreement.producerId, descriptor, tenant)) {
    return pending;
  }
  return active;
};

const nextStateFromActiveOrSuspended = (
  agreement: Agreement,
  descriptor: Descriptor,
  tenant: Tenant
): AgreementState => {
  if (agreement.consumerId === agreement.producerId) {
    return active;
  }
  if (
    certifiedAttributesSatisfied(descriptor, tenant) &&
    declaredAttributesSatisfied(descriptor, tenant) &&
    verifiedAttributesSatisfied(agreement.producerId, descriptor, tenant)
  ) {
    return active;
  }
  return suspended;
};

const nextStateFromMissingCertifiedAttributes = (
  descriptor: Descriptor,
  tenant: Tenant
): AgreementState => {
  if (certifiedAttributesSatisfied(descriptor, tenant)) {
    return draft;
  }
  return missingCertifiedAttributes;
};

export const nextState = (
  agreement: Agreement,
  descriptor: Descriptor,
  tenant: Tenant
): AgreementState =>
  match(agreement.state)
    .with(agreementState.draft, () =>
      nextStateFromDraft(agreement, descriptor, tenant)
    )
    .with(agreementState.pending, () =>
      nextStateFromPending(agreement, descriptor, tenant)
    )
    .with(agreementState.active, agreementState.suspended, () =>
      nextStateFromActiveOrSuspended(agreement, descriptor, tenant)
    )
    .with(agreementState.archived, () => archived)
    .with(agreementState.missingCertifiedAttributes, () =>
      nextStateFromMissingCertifiedAttributes(descriptor, tenant)
    )
    .with(agreementState.rejected, () => rejected)
    .exhaustive();

export const agreementStateByFlags = (
  stateByAttribute: AgreementState,
  suspendedByProducer: boolean | undefined,
  suspendedByConsumer: boolean | undefined,
  suspendedByPlatform: boolean | undefined
): AgreementState =>
  match([
    stateByAttribute,
    suspendedByProducer,
    suspendedByConsumer,
    suspendedByPlatform,
  ])
    .with(
      [agreementState.active, true, P.any, P.any],
      () => agreementState.suspended
    )
    .with(
      [agreementState.active, P.any, true, P.any],
      () => agreementState.suspended
    )
    .with(
      [agreementState.active, P.any, P.any, true],
      () => agreementState.suspended
    )
    .otherwise(() => stateByAttribute);

export const suspendedByPlatformFlag = (state: AgreementState): boolean =>
  state === agreementState.suspended ||
  state === agreementState.missingCertifiedAttributes;

export const suspendedByConsumerFlag = (
  agreement: Agreement,
  requesterOrgId: string,
  destinationState: AgreementState
): boolean | undefined =>
  requesterOrgId === agreement.consumerId
    ? destinationState === agreementState.suspended
    : agreement.suspendedByConsumer;

export const suspendedByProducerFlag = (
  agreement: Agreement,
  requesterOrgId: string,
  destinationState: AgreementState
): boolean | undefined =>
  requesterOrgId === agreement.producerId
    ? destinationState === agreementState.suspended
    : agreement.suspendedByProducer;

export const suspendedByConsumerStamp = (
  agreement: Agreement,
  requesterOrgId: string,
  destinationState: AgreementState,
  userId: string
): AgreementStamp | undefined =>
  match([requesterOrgId, destinationState])
    .with([agreement.consumerId, agreementState.suspended], () => ({
      who: userId,
      when: utcToZonedTime(new Date(), "Etc/UTC"),
    }))
    .with([agreement.consumerId, P.any], () => undefined)
    .otherwise(() => agreement.stamps.suspensionByConsumer);

export const suspendedByProducerStamp = (
  agreement: Agreement,
  requesterOrgId: string,
  destinationState: AgreementState,
  userId: string
): AgreementStamp | undefined =>
  match([requesterOrgId, destinationState])
    .with([agreement.producerId, agreementState.suspended], () => ({
      who: userId,
      when: utcToZonedTime(new Date(), "Etc/UTC"),
    }))
    .with([agreement.producerId, P.any], () => undefined)
    .otherwise(() => agreement.stamps.suspensionByProducer);
