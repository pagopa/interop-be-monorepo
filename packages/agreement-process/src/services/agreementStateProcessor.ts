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
import { CreateEvent, Logger } from "pagopa-interop-commons";
import {
  certifiedAttributesSatisfied,
  declaredAttributesSatisfied,
  verifiedAttributesSatisfied,
} from "../model/domain/validators.js";
import {
  toCreateEventAgreementPutInDraftByPlatform,
  toCreateEventAgreementPutInMissingCertifiedAttributesByPlatform,
  toCreateEventAgreementSuspendedByPlatform,
  toCreateEventAgreementUnsuspendedByPlatform,
} from "../model/domain/toEvent.js";
import { CompactTenant } from "../model/domain/models.js";
import { eServiceNotFound } from "../model/domain/errors.js";
import { ReadModelService } from "./readModelService.js";

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
  match(state)
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
  consumer: CompactTenant,
  eservices: EService[],
  correlationId: string,
  logger: Logger
): Promise<CreateEvent<AgreementEvent> | void> {
  const descriptor = eservices
    .find((eservice) => eservice.id === agreement.data.eserviceId)
    ?.descriptors.find(
      (descriptor) => descriptor.id === agreement.data.descriptorId
    );

  if (!descriptor) {
    logger.error(
      `Descriptor ${agreement.data.descriptorId} not found for Agreement ${agreement.data.id} - EService ${agreement.data.eserviceId}`
    );
    return;
  }

  const nextState = nextStateByAttributes(agreement.data, descriptor, consumer);

  const newSuspendedByPlatform = suspendedByPlatformFlag(nextState);

  const finalState = agreementStateByFlags(
    nextState,
    agreement.data.suspendedByProducer,
    agreement.data.suspendedByConsumer,
    newSuspendedByPlatform
  );

  const updatedAgreement: Agreement = {
    ...agreement.data,
    state: finalState,
    suspendedByPlatform: newSuspendedByPlatform,
  };

  if (allowedStateTransitions(agreement.data.state).includes(finalState)) {
    if (newSuspendedByPlatform !== agreement.data.suspendedByPlatform) {
      return match(finalState)
        .with(agreementState.suspended, () =>
          toCreateEventAgreementSuspendedByPlatform(
            updatedAgreement,
            agreement.metadata.version,
            correlationId
          )
        )
        .with(agreementState.active, () =>
          toCreateEventAgreementUnsuspendedByPlatform(
            updatedAgreement,
            agreement.metadata.version,
            correlationId
          )
        )
        .with(agreementState.missingCertifiedAttributes, () =>
          toCreateEventAgreementPutInMissingCertifiedAttributesByPlatform(
            updatedAgreement,
            agreement.metadata.version,
            correlationId
          )
        )
        .with(agreementState.draft, () =>
          toCreateEventAgreementPutInDraftByPlatform(
            updatedAgreement,
            agreement.metadata.version,
            correlationId
          )
        )
        .otherwise(
          () =>
            void logger.error(
              `Agreement state transition not allowed from ${agreement.data.state} to ${finalState} - Agreement ${agreement.data.id} - EService ${agreement.data.eserviceId} - Consumer ${consumer.id}`
            )
        );
    } else {
      logger.error(
        `Skipping Agreement state transition from ${agreement.data.state} to ${finalState}, no change in suspendedByPlatform flag - Agreement ${agreement.data.id} - EService ${agreement.data.eserviceId} - Consumer ${consumer.id}`
      );
    }
  } else {
    logger.error(
      `Agreement state transition not allowed from ${agreement.data.state} to ${finalState} - Agreement ${agreement.data.id} - EService ${agreement.data.eserviceId} - Consumer ${consumer.id}`
    );
  }
}

function eserviceContainsAttribute(
  attributeId: AttributeId,
  eservice: EService
): boolean {
  const allIds = eservice.descriptors
    .flatMap((descriptor) => [
      ...descriptor.attributes.certified,
      ...descriptor.attributes.declared,
      ...descriptor.attributes.verified,
    ])
    .flatMap((attr) => attr.map((a) => a.id));

  return allIds.includes(attributeId);
}

// eslint-disable-next-line max-params
export async function computeAgreementsStateByAttribute(
  attributeId: AttributeId,
  consumer: CompactTenant,
  readModelService: ReadModelService,
  correlationId: string,
  logger: Logger
): Promise<Array<CreateEvent<AgreementEvent>>> {
  const agreements = await readModelService.getAllAgreements({
    consumerId: consumer.id,
    agreementStates: updatableStates,
  });

  const uniqueEServiceIds = Array.from(
    new Set(agreements.map((a) => a.data.eserviceId))
  );

  const eservices: EService[] = await Promise.all(
    uniqueEServiceIds.map(async (id) => {
      // TODO replace with retrieveEservice after https://github.com/pagopa/interop-be-monorepo/pull/500
      const eservice = await readModelService.getEServiceById(id);
      if (!eservice) {
        throw eServiceNotFound(id);
      }
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
      updateAgreementState(
        agreement,
        consumer,
        eservicesWithAttribute,
        correlationId,
        logger
      )
    )
  ).then((events) =>
    events.filter(
      (event): event is NonNullable<CreateEvent<AgreementEvent>> =>
        event !== undefined
    )
  );
}
