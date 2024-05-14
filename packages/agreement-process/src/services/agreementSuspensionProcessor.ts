import { AuthData } from "pagopa-interop-commons";
import {
  Agreement,
  Descriptor,
  Tenant,
  agreementState,
} from "pagopa-interop-models";
import { UpdateAgreementSeed } from "../model/domain/models.js";
import {
  agreementStateByFlags,
  nextState,
  suspendedByConsumerFlag,
  suspendedByProducerFlag,
} from "./agreementStateProcessor.js";
import {
  createStamp,
  suspendedByConsumerStamp,
  suspendedByProducerStamp,
} from "./agreementStampUtils.js";

export function createAgreementSuspended({
  agreement,
  authData,
  descriptor,
  consumer,
}: {
  agreement: Agreement;
  authData: AuthData;
  descriptor: Descriptor;
  consumer: Tenant;
}): Agreement {
  const nextStateByAttributes = nextState(agreement, descriptor, consumer);

  const suspendedByConsumer = suspendedByConsumerFlag(
    agreement,
    authData.organizationId,
    agreementState.suspended
  );
  const suspendedByProducer = suspendedByProducerFlag(
    agreement,
    authData.organizationId,
    agreementState.suspended
  );
  const newState = agreementStateByFlags(
    nextStateByAttributes,
    suspendedByProducer,
    suspendedByConsumer
  );

  const stamp = createStamp(authData);

  const suspensionByProducerStamp = suspendedByProducerStamp(
    agreement,
    authData.organizationId,
    agreementState.suspended,
    stamp
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
