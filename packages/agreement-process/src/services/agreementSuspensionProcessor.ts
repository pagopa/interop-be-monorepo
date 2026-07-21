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
import { getSuspensionFlags } from "./agreementService.js";
import { createStamp, getSuspensionStamps } from "./agreementStampUtils.js";

export function createSuspensionUpdatedAgreement({
  agreement,
  authData,
  activeDelegations,
  agreementOwnership,
}: {
  agreement: Agreement;
  authData: UIAuthData | M2MAdminAuthData;
  activeDelegations: ActiveDelegations;
  agreementOwnership: Ownership;
}): Agreement {
  /* The Agreement is always suspended by this operation: suspension is only
  allowed from active or suspended (see agreementSuspendableStates), and the
  requester is always the producer, the consumer, or one of their delegates,
  so at least one suspension flag is set. Therefore the next state by
  attributes would always be overridden, and it is not computed here. */
  const targetDestinationState = agreementState.suspended;

  const { suspendedByConsumer, suspendedByProducer } = getSuspensionFlags(
    agreementOwnership,
    agreement,
    authData,
    targetDestinationState,
    activeDelegations
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
    state: targetDestinationState,
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
