import {
  Agreement,
  AgreementEvent,
  AgreementState,
  Descriptor,
  Tenant,
  WithMetadata,
  agreementState,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { CreateEvent } from "pagopa-interop-commons";
import {
  certifiedAttributesSatisfied,
  computeAgreementStateAllowedTransitions,
  declaredAttributesSatisfied,
  verifiedAttributesSatisfied,
} from "../model/domain/validators.js";
import { ApiComputeAgreementStatePayload } from "../model/types.js";
import { UpdateAgreementSeed } from "../model/domain/models.js";
import {
  toCreateEventAgreementSuspendedByPlatform,
  toCreateEventAgreementUnsuspendedByPlatform,
} from "../model/domain/toEvent.js";

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
      [agreementState.active, P.any, true, P.any],
      [agreementState.active, P.any, P.any, true],
      () => agreementState.suspended
    )
    .otherwise(() => stateByAttribute);

export const suspendedByPlatformFlag = (fsmState: AgreementState): boolean =>
  fsmState === agreementState.suspended ||
  fsmState === agreementState.missingCertifiedAttributes;

export const suspendedByConsumerFlag = (
  agreement: Agreement,
  requesterOrgId: Tenant["id"],
  destinationState: AgreementState
): boolean | undefined =>
  requesterOrgId === agreement.consumerId
    ? destinationState === agreementState.suspended
    : agreement.suspendedByConsumer;

export const suspendedByProducerFlag = (
  agreement: Agreement,
  requesterOrgId: Tenant["id"],
  destinationState: AgreementState
): boolean | undefined =>
  requesterOrgId === agreement.producerId
    ? destinationState === agreementState.suspended
    : agreement.suspendedByProducer;

async function updateAgreementState(
  agreement: WithMetadata<Agreement>,
  state: AgreementState,
  correlationId: string
): Promise<CreateEvent<AgreementEvent> | void> {
  const newSuspendedByPlatform = suspendedByPlatformFlag(state);

  const finalState = agreementStateByFlags(
    state,
    agreement.data.suspendedByProducer,
    agreement.data.suspendedByConsumer,
    newSuspendedByPlatform
  );

  const updatedAgreement: Agreement = {
    ...agreement.data,
    state: finalState,
    suspendedByPlatform: newSuspendedByPlatform,
  };

  if (
    newSuspendedByPlatform !== agreement.data.suspendedByPlatform &&
    computeAgreementStateAllowedTransitions(agreement.data.state).includes(
      finalState
    )
  ) {
    if (newSuspendedByPlatform === true) {
      return toCreateEventAgreementSuspendedByPlatform(
        updatedAgreement,
        agreement.metadata.version,
        correlationId
      );
    } else {
      return toCreateEventAgreementUnsuspendedByPlatform(
        updatedAgreement,
        agreement.metadata.version,
        correlationId
      );
    }
  }
}

export async function computeAgreementStateLogic(
  payload: ApiComputeAgreementStatePayload
): Promise<CreateEvent<AgreementEvent>> {
  // TODO implement, call updateAgreementState defined above etc.
  // TODO consider moving all in this function
}
