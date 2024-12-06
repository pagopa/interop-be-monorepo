import { AuthData, CreateEvent } from "pagopa-interop-commons";
import {
  Agreement,
  AgreementEventV2,
  CorrelationId,
  Delegation,
  Descriptor,
  Tenant,
  TenantId,
  WithMetadata,
  agreementState,
  genericError,
} from "pagopa-interop-models";
import { UpdateAgreementSeed } from "../model/domain/models.js";
import {
  toCreateEventAgreementSuspendedByProducer,
  toCreateEventAgreementSuspendedByConsumer,
} from "../model/domain/toEvent.js";
import {
  agreementStateByFlags,
  nextStateByAttributesFSM,
  suspendedByConsumerFlag,
  suspendedByProducerFlag,
} from "./agreementStateProcessor.js";
import {
  createStamp,
  suspendedByConsumerStamp,
  suspendedByProducerStamp,
} from "./agreementStampUtils.js";

export function createSuspensionUpdatedAgreement({
  agreement,
  authData,
  descriptor,
  consumer,
  producerDelegation,
}: {
  agreement: Agreement;
  authData: AuthData;
  descriptor: Descriptor;
  consumer: Tenant;
  producerDelegation: Delegation | undefined;
}): Agreement {
  /* nextAttributesState VS targetDestinationState
  -- targetDestinationState is the state where the caller wants to go (suspended, in this case)
  -- nextStateByAttributes is the next state of the Agreement based the attributes of the consumer
  */
  const targetDestinationState = agreementState.suspended;
  const nextStateByAttributes = nextStateByAttributesFSM(
    agreement,
    descriptor,
    consumer
  );

  const suspendedByConsumer = suspendedByConsumerFlag(
    agreement,
    authData.organizationId,
    targetDestinationState
  );
  const suspendedByProducer = suspendedByProducerFlag(
    agreement,
    authData.organizationId,
    targetDestinationState,
    producerDelegation?.delegateId
  );

  const newState = agreementStateByFlags(
    nextStateByAttributes,
    suspendedByProducer,
    suspendedByConsumer,
    agreement.suspendedByPlatform
  );

  const stamp = createStamp(authData.userId, producerDelegation?.id);

  const suspensionByProducerStamp = suspendedByProducerStamp(
    agreement,
    authData.organizationId,
    agreementState.suspended,
    stamp,
    producerDelegation?.delegateId
  );

  const suspensionByConsumerStamp = suspendedByConsumerStamp(
    agreement,
    authData.organizationId,
    agreementState.suspended,
    stamp
  );

  const updateSeed: UpdateAgreementSeed = {
    state: newState,
    suspendedByConsumer,
    suspendedByProducer,
    stamps: {
      ...agreement.stamps,
      suspensionByConsumer: suspensionByConsumerStamp,
      suspensionByProducer: suspensionByProducerStamp,
    },
    suspendedAt: agreement.suspendedAt ?? new Date(),
  };

  return {
    ...agreement,
    ...updateSeed,
  };
}

export function createAgreementSuspendedEvent(
  organizationId: TenantId,
  correlationId: CorrelationId,
  updatedAgreement: Agreement,
  agreement: WithMetadata<Agreement>,
  delegateProducerId: TenantId | undefined
): CreateEvent<AgreementEventV2> {
  const isProducer = organizationId === agreement.data.producerId;
  const isConsumer = organizationId === agreement.data.consumerId;
  const isProducerDelegate = delegateProducerId === organizationId;

  if (!isProducer && !isConsumer && !isProducerDelegate) {
    throw genericError(
      "Agreement can only be suspended by the consumer or producer/delegate producer."
    );
  }

  return isProducer || isProducerDelegate
    ? toCreateEventAgreementSuspendedByProducer(
        updatedAgreement,
        agreement.metadata.version,
        correlationId
      )
    : toCreateEventAgreementSuspendedByConsumer(
        updatedAgreement,
        agreement.metadata.version,
        correlationId
      );
}
