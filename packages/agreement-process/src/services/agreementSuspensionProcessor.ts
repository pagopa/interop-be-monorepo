import {
  CreateEvent,
  M2MAdminAuthData,
  Ownership,
  ownership,
  UIAuthData,
} from "pagopa-interop-commons";
import {
  Agreement,
  AgreementEventV2,
  CorrelationId,
  Descriptor,
  Tenant,
  WithMetadata,
  agreementState,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import {
  ActiveDelegations,
  UpdateAgreementSeed,
} from "../model/domain/models.js";
import {
  toCreateEventAgreementSuspendedByProducer,
  toCreateEventAgreementSuspendedByConsumer,
} from "../model/domain/toEvent.js";
import {
  agreementStateByFlags,
  nextStateByAttributesFSM,
} from "./agreementStateProcessor.js";
import { createStamp, getSuspensionStamps } from "./agreementStampUtils.js";
import { getSuspensionFlags } from "./agreementService.js";

export function createSuspensionUpdatedAgreement({
  agreement,
  authData,
  descriptor,
  consumer,
  activeDelegations,
  agreementOwnership,
}: {
  agreement: Agreement;
  authData: UIAuthData | M2MAdminAuthData;
  descriptor: Descriptor;
  consumer: Tenant;
  activeDelegations: ActiveDelegations;
  agreementOwnership: Ownership;
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

  const { suspendedByConsumer, suspendedByProducer } = getSuspensionFlags(
    agreementOwnership,
    agreement,
    authData,
    targetDestinationState,
    activeDelegations
  );

  const newState = agreementStateByFlags(
    nextStateByAttributes,
    suspendedByProducer,
    suspendedByConsumer,
    agreement.suspendedByPlatform
  );

  const stamp = createStamp(authData, activeDelegations);

  const { suspensionByConsumer, suspensionByProducer } = getSuspensionStamps({
    agreementOwnership,
    agreement,
    newAgreementState: agreementState.suspended,
    authData,
    stamp,
    activeDelegations,
  });

  const updateSeed: UpdateAgreementSeed = {
    state: newState,
    suspendedByConsumer,
    suspendedByProducer,
    stamps: {
      ...agreement.stamps,
      suspensionByConsumer,
      suspensionByProducer,
    },
    suspendedAt: agreement.suspendedAt ?? new Date(),
  };

  return {
    ...agreement,
    ...updateSeed,
  };
}

// eslint-disable-next-line max-params
export function createAgreementSuspendedEvent(
  correlationId: CorrelationId,
  updatedAgreement: Agreement,
  agreement: WithMetadata<Agreement>,
  agreementOwnership: Ownership
): CreateEvent<AgreementEventV2> {
  return match(agreementOwnership)
    .with(P.union(ownership.PRODUCER, ownership.SELF_CONSUMER), () =>
      toCreateEventAgreementSuspendedByProducer(
        updatedAgreement,
        agreement.metadata.version,
        correlationId
      )
    )
    .with(ownership.CONSUMER, () =>
      toCreateEventAgreementSuspendedByConsumer(
        updatedAgreement,
        agreement.metadata.version,
        correlationId
      )
    )
    .exhaustive();
}
