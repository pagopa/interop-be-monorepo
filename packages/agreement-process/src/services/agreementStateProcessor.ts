import {
  Agreement,
  AgreementEvent,
  AgreementState,
  AttributeId,
  Descriptor,
  EService,
  Tenant,
  WithMetadata,
  agreementState,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { CreateEvent } from "pagopa-interop-commons";
import {
  assertDescriptorExist,
  assertEServiceExist,
  certifiedAttributesSatisfied,
  declaredAttributesSatisfied,
  verifiedAttributesSatisfied,
} from "../model/domain/validators.js";
import {
  toCreateEventAgreementSuspendedByPlatform,
  toCreateEventAgreementUnsuspendedByPlatform,
} from "../model/domain/toEvent.js";
import { CompactTenant } from "../model/domain/models.js";
import { AgreementQuery } from "./readmodel/agreementQuery.js";
import { EserviceQuery } from "./readmodel/eserviceQuery.js";

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
  tenant: Tenant | CompactTenant
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
  tenant: Tenant | CompactTenant
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
  tenant: Tenant | CompactTenant
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
  tenant: Tenant | CompactTenant
): AgreementState => {
  if (certifiedAttributesSatisfied(descriptor, tenant)) {
    return draft;
  }
  return missingCertifiedAttributes;
};

export const nextStateByAttributes = (
  agreement: Agreement,
  descriptor: Descriptor,
  tenant: Tenant | CompactTenant
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

const allowedStateTransitions = (state: AgreementState): AgreementState[] =>
  match<AgreementState, AgreementState[]>(state)
    .with(agreementState.draft, agreementState.pending, () => [
      agreementState.missingCertifiedAttributes,
    ])
    .with(agreementState.missingCertifiedAttributes, () => [
      agreementState.draft,
    ])
    .with(agreementState.active, () => [agreementState.suspended])
    .with(agreementState.suspended, () => [
      agreementState.active,
      agreementState.suspended,
    ])
    .with(agreementState.archived, agreementState.rejected, () => [])
    .exhaustive();

const updatableStates = Object.values(agreementState).filter(
  (state) => allowedStateTransitions(state).length > 0
);

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
    allowedStateTransitions(agreement.data.state).includes(finalState)
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

// TODO needed?
async function updateAgreementStates(
  agreement: WithMetadata<Agreement>,
  consumer: CompactTenant,
  eservices: EService[], // TODO needed?
  correlationId: string
): Promise<CreateEvent<AgreementEvent> | void> {
  const descriptor = eservices
    .find((eservice) => eservice.id === agreement.data.eserviceId)
    ?.descriptors.find(
      (descriptor) => descriptor.id === agreement.data.descriptorId
    );

  assertDescriptorExist(
    agreement.data.eserviceId,
    agreement.data.descriptorId,
    descriptor
  );

  const nextState = nextStateByAttributes(agreement.data, descriptor, consumer);

  return updateAgreementState(agreement, nextState, correlationId);
}

function eserviceContainsAttribute(
  attributeId: AttributeId,
  eservice: EService
): boolean {
  const certified = eservice.descriptors.flatMap(
    (descriptor) => descriptor.attributes.certified
  );
  const declared = eservice.descriptors.flatMap(
    (descriptor) => descriptor.attributes.declared
  );
  const verified = eservice.descriptors.flatMap(
    (descriptor) => descriptor.attributes.verified
  );

  const allIds = [...certified, ...declared, ...verified].flatMap((attr) =>
    attr.map((a) => a.id)
  );

  return allIds.includes(attributeId);
}

export async function computeAgreementStateByAttribute(
  attributeId: AttributeId,
  consumer: CompactTenant,
  agreementQuery: AgreementQuery,
  eserviceQuery: EserviceQuery,
  correlationId: string
): Promise<Array<CreateEvent<AgreementEvent>>> {
  const agreements = await agreementQuery.getAllAgreements({
    consumerId: consumer.id,
    agreementStates: updatableStates,
  });

  const eservices = await Promise.all(
    agreements
      .map((agreement) => agreement.data.eserviceId)
      .map(async (eserviceId) => {
        const eservice = await eserviceQuery.getEServiceById(eserviceId);
        assertEServiceExist(eserviceId, eservice);
        return eservice;
      })
  );

  const eservicesWithAttribute = eservices.filter((eservice) =>
    eserviceContainsAttribute(attributeId, eservice)
  );

  const agreementsToUpdate = agreements.filter((agreement) =>
    eservicesWithAttribute.some(
      (eservice) => eservice.id === agreement.data.eserviceId
    )
  );

  return Promise.all(
    agreementsToUpdate.map((agreement) =>
      updateAgreementStates(
        agreement,
        consumer,
        eservicesWithAttribute,
        correlationId
      )
    )
  ).then((events) =>
    events.filter(
      (event): event is CreateEvent<AgreementEvent> => event !== undefined
    )
  );
}
